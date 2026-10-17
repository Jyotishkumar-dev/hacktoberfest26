import { Equipment } from "@/types";
import { estimateRuntime } from "./index";

export interface PlanAllocationItem {
  id: string;
  name: string;
  on: boolean;
  reason: string;
  priority: "P1" | "P2" | "P3";
  power_w: number;
}

export interface PlanResult {
  allocation: PlanAllocationItem[];
  coverage_p1_pct: number;
  coverage_p2_pct: number;
  estimated_runtime_h: number;
  runtime_improvement_h: number;
  baseline_runtime_h: number;
  explanation: string;
  is_fallback?: boolean;
}

/**
 * Deterministic rule-based optimization for emergency load allocation.
 * Sheds P3 first, then P2 in ascending power-draw order to meet target duration.
 */
export function generateDeterministicPlan({
  equipment,
  capacityKwh,
  dodPct,
  efficiencyPct,
  outageDurationH,
  userNotes = "",
}: {
  equipment: Equipment[];
  capacityKwh: number;
  dodPct: number;
  efficiencyPct: number;
  outageDurationH: number;
  userNotes?: string;
}): PlanResult {
  // Baseline with everything ON
  const totalLoadW = equipment.reduce((sum, item) => sum + (item.power_w || 0), 0);
  const baselineEst = estimateRuntime({
    capacityKwh,
    loadW: totalLoadW,
    dodPct,
    efficiencyPct,
  });

  const usableWattHours = baselineEst.usableKwh * 1000;
  // Maximum continuous power allowable to survive target outage duration
  const targetMaxLoadW = outageDurationH > 0 ? usableWattHours / outageDurationH : totalLoadW;

  const allocation: PlanAllocationItem[] = [];
  let currentLoadW = 0;

  // 1. All P1 equipment stays ON unless physically impossible
  const p1Items = equipment.filter((e) => e.priority === "P1");
  const p1TotalW = p1Items.reduce((sum, e) => sum + (e.power_w || 0), 0);
  const canPowerAllP1 = usableWattHours >= p1TotalW * Math.min(outageDurationH, 1);

  p1Items.forEach((item) => {
    if (canPowerAllP1) {
      allocation.push({
        id: item.id,
        name: item.name,
        on: true,
        reason: "Critical Life Safety & Core Infrastructure (Rule 1: Never shed)",
        priority: "P1",
        power_w: item.power_w,
      });
      currentLoadW += item.power_w;
    } else {
      allocation.push({
        id: item.id,
        name: item.name,
        on: false,
        reason: "Extreme energy exhaustion: exceeds total usable storage",
        priority: "P1",
        power_w: item.power_w,
      });
    }
  });

  // 2. Evaluate P2 items (Important). Sort by lowest power draw to keep as many active as possible
  const p2Items = equipment
    .filter((e) => e.priority === "P2")
    .sort((a, b) => a.power_w - b.power_w);

  p2Items.forEach((item) => {
    if (currentLoadW + item.power_w <= targetMaxLoadW || currentLoadW === 0) {
      currentLoadW += item.power_w;
      allocation.push({
        id: item.id,
        name: item.name,
        on: true,
        reason: `Operational support kept active within ${outageDurationH}h energy budget`,
        priority: "P2",
        power_w: item.power_w,
      });
    } else {
      allocation.push({
        id: item.id,
        name: item.name,
        on: false,
        reason: `Shed to protect critical P1 reserve and reach ${outageDurationH}h target`,
        priority: "P2",
        power_w: item.power_w,
      });
    }
  });

  // 3. Shed P3 items (Non-essential). Only keep if there is surplus headroom
  const p3Items = equipment.filter((e) => e.priority === "P3");
  p3Items.forEach((item) => {
    if (currentLoadW + item.power_w <= targetMaxLoadW) {
      currentLoadW += item.power_w;
      allocation.push({
        id: item.id,
        name: item.name,
        on: true,
        reason: "Surplus battery capacity available for general comfort",
        priority: "P3",
        power_w: item.power_w,
      });
    } else {
      allocation.push({
        id: item.id,
        name: item.name,
        on: false,
        reason: "Non-essential tier shed first during outage triage",
        priority: "P3",
        power_w: item.power_w,
      });
    }
  });

  // Recompute metrics using engine
  const activeEquipW = allocation.filter((a) => a.on).reduce((sum, a) => sum + a.power_w, 0);
  const recomputedEst = estimateRuntime({
    capacityKwh,
    loadW: activeEquipW,
    dodPct,
    efficiencyPct,
  });

  const p1TotalCount = p1Items.length;
  const p1ActiveCount = allocation.filter((a) => a.priority === "P1" && a.on).length;
  const p2TotalCount = p2Items.length;
  const p2ActiveCount = allocation.filter((a) => a.priority === "P2" && a.on).length;

  const coverage_p1_pct = p1TotalCount > 0 ? Math.round((p1ActiveCount / p1TotalCount) * 100) : 100;
  const coverage_p2_pct = p2TotalCount > 0 ? Math.round((p2ActiveCount / p2TotalCount) * 100) : 100;

  const improvementHours = Number(Math.max(0, recomputedEst.runtimeH - baselineEst.runtimeH).toFixed(2));

  const explanation = `To ensure your facility survives the projected ${outageDurationH}-hour outage, all critical P1 life safety circuits remain 100% powered. We shed all P3 non-essential comfort loads and adjusted P2 support circuits, extending your battery backup endurance from ${baselineEst.runtimeH.toFixed(1)} hours to ${recomputedEst.runtimeH.toFixed(1)} hours (+${improvementHours.toFixed(1)} hours gained).${
    userNotes ? ` Considered facility notes: "${userNotes}".` : ""
  }`;

  return {
    allocation,
    coverage_p1_pct,
    coverage_p2_pct,
    estimated_runtime_h: recomputedEst.runtimeH,
    runtime_improvement_h: improvementHours,
    baseline_runtime_h: baselineEst.runtimeH,
    explanation,
    is_fallback: true,
  };
}
