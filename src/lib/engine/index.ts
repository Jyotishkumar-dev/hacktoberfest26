import { Category, Equipment, RuntimeEstimate, SensitivityItem, SimulationResult, TimeSeriesPoint } from "@/types";

export type RestorationCurveType = "flat" | "increasing" | "peak_dip";

export interface RuntimeParams {
  capacityKwh: number;
  loadW: number;
  dodPct: number;
  efficiencyPct: number;
}

/**
 * Pure calculation for battery runtime using the core formula:
 * Runtime (h) = (Capacity_kWh * (DoD% / 100) * (Efficiency% / 100) * 1000) / Load_W
 */
export function estimateRuntime({
  capacityKwh,
  loadW,
  dodPct,
  efficiencyPct,
}: RuntimeParams): RuntimeEstimate {
  const safeCapacity = Math.max(0, capacityKwh || 0);
  const safeDod = Math.min(100, Math.max(0, dodPct ?? 80)) / 100;
  const safeEff = Math.min(100, Math.max(0, efficiencyPct ?? 92)) / 100;
  const safeLoad = Math.max(0, loadW || 0);

  const usableKwh = Number((safeCapacity * safeDod * safeEff).toFixed(4));
  const drainRateW = safeLoad;

  if (safeLoad <= 0) {
    return {
      runtimeH: safeCapacity > 0 ? 999.0 : 0,
      usableKwh,
      drainRateW: 0,
    };
  }

  const usableWattHours = usableKwh * 1000;
  const runtimeH = Number((usableWattHours / safeLoad).toFixed(3));

  return {
    runtimeH,
    usableKwh,
    drainRateW,
  };
}

/**
 * Computes active load in Watts for equipment based on allocation/active state.
 */
export function calculateActiveLoad(
  equipmentList: Equipment[],
  allocation?: Record<string, boolean>
): number {
  return equipmentList.reduce((sum, item) => {
    const isActive = allocation ? allocation[item.id] !== false : item.is_active !== false;
    return isActive ? sum + (item.power_w || 0) : sum;
  }, 0);
}

/**
 * Generates sensitivity table showing how much runtime is gained by shedding each category.
 */
export function sensitivityTable(
  equipment: Equipment[],
  params: {
    capacityKwh: number;
    dodPct: number;
    efficiencyPct: number;
    allocation?: Record<string, boolean>;
  }
): SensitivityItem[] {
  const activeItems = equipment.filter((item) =>
    params.allocation ? params.allocation[item.id] !== false : item.is_active !== false
  );

  const baseLoadW = calculateActiveLoad(equipment, params.allocation);
  const baseEstimate = estimateRuntime({
    capacityKwh: params.capacityKwh,
    loadW: baseLoadW,
    dodPct: params.dodPct,
    efficiencyPct: params.efficiencyPct,
  });

  const categories: Category[] = ["HVAC", "IT", "Medical", "Lighting", "Security", "Other"];
  const results: SensitivityItem[] = [];

  for (const cat of categories) {
    const itemsInCat = activeItems.filter((i) => i.category === cat);
    if (itemsInCat.length === 0) continue;

    const catLoadW = itemsInCat.reduce((acc, curr) => acc + (curr.power_w || 0), 0);
    const loadWithoutCat = Math.max(0, baseLoadW - catLoadW);

    const newEstimate = estimateRuntime({
      capacityKwh: params.capacityKwh,
      loadW: loadWithoutCat,
      dodPct: params.dodPct,
      efficiencyPct: params.efficiencyPct,
    });

    const runtimeGainH = Number(Math.max(0, newEstimate.runtimeH - baseEstimate.runtimeH).toFixed(2));

    results.push({
      category: cat,
      itemCount: itemsInCat.length,
      totalLoadW: catLoadW,
      newRuntimeH: newEstimate.runtimeH,
      runtimeGainH,
    });
  }

  return results.sort((a, b) => b.runtimeGainH - a.runtimeGainH);
}

/**
 * Calculates informational grid restoration probability (%) based on restoration curve pattern.
 */
export function calculateRestorationLikelihood(
  curveType: RestorationCurveType,
  timeH: number,
  totalDurationH: number
): number {
  const progress = Math.min(1, Math.max(0, timeH / Math.max(0.5, totalDurationH)));

  switch (curveType) {
    case "flat":
      return 25; // Constant baseline repair probability
    case "increasing":
      // Smoothly rises from 10% to 90% as time progresses
      return Math.round(10 + progress * 80);
    case "peak_dip": {
      // Rises early, dips during peak stress hours (40%-60% progress), then recovers
      if (progress < 0.4) {
        return Math.round(15 + (progress / 0.4) * 35); // 15% -> 50%
      } else if (progress < 0.65) {
        return Math.round(50 - ((progress - 0.4) / 0.25) * 25); // Dips down to 25%
      } else {
        return Math.round(25 + ((progress - 0.65) / 0.35) * 65); // Recovers up to 90%
      }
    }
  }
}

/**
 * Simulates battery drain timeline with support for progressive tier dropouts,
 * dynamic mid-simulation overrides, and restoration likelihood curves.
 */
export function runSimulation({
  equipment,
  allocation = {},
  capacityKwh,
  dodPct,
  efficiencyPct,
  durationH = 8,
  restorationCurve = "increasing",
  autoTierDropout = true,
}: {
  equipment: Equipment[];
  allocation?: Record<string, boolean>;
  capacityKwh: number;
  dodPct: number;
  efficiencyPct: number;
  durationH?: number;
  restorationCurve?: RestorationCurveType;
  autoTierDropout?: boolean;
}): SimulationResult & {
  restorationTimeline: { timeH: number; label: string; likelihoodPct: number }[];
  tierDropoutTimes: { p3DropoutH: number | null; p2DropoutH: number | null; p1DropoutH: number | null };
} {
  const initialEstimate = estimateRuntime({
    capacityKwh,
    loadW: calculateActiveLoad(equipment, allocation),
    dodPct,
    efficiencyPct,
  });

  const totalUsableKwh = initialEstimate.usableKwh;
  const timeline: TimeSeriesPoint[] = [];
  const restorationTimeline: { timeH: number; label: string; likelihoodPct: number }[] = [];

  const stepMinutes = 30;
  const totalSteps = Math.ceil((durationH * 60) / stepMinutes);

  let currentRemainingKwh = totalUsableKwh;
  let depletionTimeH: number | null = null;
  let p3DropoutH: number | null = null;
  let p2DropoutH: number | null = null;
  let p1DropoutH: number | null = null;

  // Active status tracker per equipment
  const currentAllocation: Record<string, boolean> = {};
  for (const item of equipment) {
    currentAllocation[item.id] = allocation[item.id] !== undefined ? allocation[item.id] : item.is_active !== false;
  }

  for (let step = 0; step <= totalSteps; step++) {
    const timeH = Number(((step * stepMinutes) / 60).toFixed(2));
    const hours = Math.floor(timeH);
    const mins = Math.round((timeH - hours) * 60);
    const label = `${hours}h ${mins > 0 ? `${mins}m` : "00m"}`;

    const batteryPct = totalUsableKwh > 0
      ? Number(Math.min(100, Math.max(0, (currentRemainingKwh / totalUsableKwh) * 100)).toFixed(1))
      : 0;

    let dropoutEvent: string | undefined = undefined;

    // Auto tier dropout thresholds
    if (autoTierDropout && step > 0) {
      if (batteryPct <= 25 && p3DropoutH === null) {
        p3DropoutH = timeH;
        dropoutEvent = `P3 Non-Essential Shed at ${label} (Battery ≤ 25%)`;
        equipment.filter((e) => e.priority === "P3").forEach((e) => {
          currentAllocation[e.id] = false;
        });
      }
      if (batteryPct <= 10 && p2DropoutH === null) {
        p2DropoutH = timeH;
        dropoutEvent = `P2 Important Shed at ${label} (Battery ≤ 10%)`;
        equipment.filter((e) => e.priority === "P2").forEach((e) => {
          currentAllocation[e.id] = false;
        });
      }
    }

    if (currentRemainingKwh <= 0 && depletionTimeH === null) {
      depletionTimeH = timeH;
      p1DropoutH = timeH;
      dropoutEvent = `Full Depletion & P1 Dropout at ${label}`;
    }

    // Active load at current step
    const stepActiveLoadW = currentRemainingKwh > 0
      ? equipment.reduce((sum, item) => (currentAllocation[item.id] ? sum + (item.power_w || 0) : sum), 0)
      : 0;

    timeline.push({
      timeH,
      label,
      batteryPct,
      remainingKwh: Number(currentRemainingKwh.toFixed(3)),
      activeLoadW: stepActiveLoadW,
      equipmentState: { ...currentAllocation },
      dropoutEvent,
    });

    restorationTimeline.push({
      timeH,
      label,
      likelihoodPct: calculateRestorationLikelihood(restorationCurve, timeH, durationH),
    });

    // Drain energy for next 30-minute interval (0.5h)
    if (currentRemainingKwh > 0) {
      const stepEnergyDrainKwh = (stepActiveLoadW / 1000) * 0.5;
      currentRemainingKwh = Math.max(0, currentRemainingKwh - stepEnergyDrainKwh);
    }
  }

  return {
    timeline,
    depletionTimeH,
    p1CoveredUntilH: depletionTimeH || durationH,
    totalInitialLoadW: initialEstimate.drainRateW,
    usableKwh: totalUsableKwh,
    restorationTimeline,
    tierDropoutTimes: { p3DropoutH, p2DropoutH, p1DropoutH },
  };
}
