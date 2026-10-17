import { Category, Equipment, RuntimeEstimate, SensitivityItem, SimulationResult, TimeSeriesPoint } from "@/types";

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

  // Group by category
  const categories: Category[] = ['HVAC', 'IT', 'Medical', 'Lighting', 'Security', 'Other'];
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

  // Sort by highest runtime gain
  return results.sort((a, b) => b.runtimeGainH - a.runtimeGainH);
}

/**
 * Simulates battery drain timeline at 30-minute intervals.
 */
export function runSimulation({
  equipment,
  allocation = {},
  capacityKwh,
  dodPct,
  efficiencyPct,
  durationH = 8,
}: {
  equipment: Equipment[];
  allocation?: Record<string, boolean>;
  capacityKwh: number;
  dodPct: number;
  efficiencyPct: number;
  durationH?: number;
}): SimulationResult {
  const initialEstimate = estimateRuntime({
    capacityKwh,
    loadW: calculateActiveLoad(equipment, allocation),
    dodPct,
    efficiencyPct,
  });

  const totalUsableKwh = initialEstimate.usableKwh;
  const initialActiveLoadW = initialEstimate.drainRateW;

  const timeline: TimeSeriesPoint[] = [];
  const stepMinutes = 30;
  const totalSteps = Math.ceil((durationH * 60) / stepMinutes);

  let currentRemainingKwh = totalUsableKwh;
  let depletionTimeH: number | null = null;
  let p1CoveredUntilH = durationH;

  // Active status map
  const activeMap: Record<string, boolean> = {};
  for (const item of equipment) {
    activeMap[item.id] = allocation[item.id] !== undefined ? allocation[item.id] : item.is_active !== false;
  }

  for (let step = 0; step <= totalSteps; step++) {
    const timeH = Number(((step * stepMinutes) / 60).toFixed(2));
    const hours = Math.floor(timeH);
    const mins = Math.round((timeH - hours) * 60);
    const label = `${hours}h ${mins > 0 ? `${mins}m` : '00m'}`;

    // Calculate drain for this 30-minute interval (0.5 hours)
    if (step > 0 && currentRemainingKwh > 0) {
      const stepEnergyDrainKwh = (initialActiveLoadW / 1000) * 0.5;
      currentRemainingKwh = Math.max(0, currentRemainingKwh - stepEnergyDrainKwh);
      if (currentRemainingKwh === 0 && depletionTimeH === null) {
        depletionTimeH = timeH;
        p1CoveredUntilH = timeH;
      }
    }

    const batteryPct = totalUsableKwh > 0 
      ? Number(Math.min(100, Math.max(0, (currentRemainingKwh / totalUsableKwh) * 100)).toFixed(1))
      : 0;

    let dropoutEvent: string | undefined = undefined;
    if (currentRemainingKwh === 0 && depletionTimeH === timeH) {
      dropoutEvent = `Battery Depleted at ${label} (Emergency Dropout)`;
    }

    timeline.push({
      timeH,
      label,
      batteryPct,
      remainingKwh: Number(currentRemainingKwh.toFixed(3)),
      activeLoadW: currentRemainingKwh > 0 ? initialActiveLoadW : 0,
      equipmentState: { ...activeMap },
      dropoutEvent,
    });
  }

  return {
    timeline,
    depletionTimeH,
    p1CoveredUntilH,
    totalInitialLoadW: initialActiveLoadW,
    usableKwh: totalUsableKwh,
  };
}
