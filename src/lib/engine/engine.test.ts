import { describe, it, expect } from "vitest";
import { estimateRuntime, sensitivityTable, runSimulation, calculateActiveLoad } from "./index";
import { Equipment } from "@/types";

describe("GridGuard AI Core Engine", () => {
  it("verifies hospital sample: 50 kWh, 80% DoD, 92% eff with 7.3 kW (7300W) gives roughly 5.0 hours", () => {
    // Usable kWh = 50 * 0.8 * 0.92 = 36.8 kWh
    // Load = 7.3 kW = 7300 W
    // Runtime = 36.8 / 7.3 = ~5.041 hours
    const result = estimateRuntime({
      capacityKwh: 50,
      loadW: 7300,
      dodPct: 80,
      efficiencyPct: 92,
    });

    expect(result.usableKwh).toBeCloseTo(36.8, 1);
    expect(result.drainRateW).toBe(7300);
    expect(result.runtimeH).toBeCloseTo(5.04, 1);
    expect(Math.round(result.runtimeH)).toBe(5);
  });

  it("handles zero load gracefully without crashing", () => {
    const result = estimateRuntime({
      capacityKwh: 50,
      loadW: 0,
      dodPct: 80,
      efficiencyPct: 92,
    });

    expect(result.usableKwh).toBeCloseTo(36.8, 1);
    expect(result.runtimeH).toBeGreaterThan(100);
  });

  it("computes active load properly across items", () => {
    const mockEquipment: Equipment[] = [
      { id: "1", facility_id: "f1", user_id: "u1", name: "ICU", category: "Medical", power_w: 2400, priority: "P1", always_on: true, is_active: true },
      { id: "2", facility_id: "f1", user_id: "u1", name: "EMR", category: "IT", power_w: 3500, priority: "P1", always_on: true, is_active: true },
      { id: "3", facility_id: "f1", user_id: "u1", name: "AC", category: "HVAC", power_w: 4000, priority: "P3", always_on: false, is_active: false },
    ];

    const load = calculateActiveLoad(mockEquipment);
    expect(load).toBe(5900);
  });

  it("calculates sensitivity table with runtime gain per category", () => {
    const mockEquipment: Equipment[] = [
      { id: "1", facility_id: "f1", user_id: "u1", name: "ICU", category: "Medical", power_w: 2400, priority: "P1", always_on: true, is_active: true },
      { id: "2", facility_id: "f1", user_id: "u1", name: "EMR", category: "IT", power_w: 3500, priority: "P1", always_on: true, is_active: true },
      { id: "3", facility_id: "f1", user_id: "u1", name: "HVAC", category: "HVAC", power_w: 4000, priority: "P3", always_on: false, is_active: true },
    ];

    const table = sensitivityTable(mockEquipment, {
      capacityKwh: 50,
      dodPct: 80,
      efficiencyPct: 92,
    });

    expect(table.length).toBeGreaterThan(0);
    // Shedding HVAC (4000W) should yield the highest gain
    expect(table[0].category).toBe("HVAC");
    expect(table[0].runtimeGainH).toBeGreaterThan(0);
  });

  it("runs simulation with 30-minute intervals and tracks dropout event", () => {
    const mockEquipment: Equipment[] = [
      { id: "1", facility_id: "f1", user_id: "u1", name: "Server", category: "IT", power_w: 10000, priority: "P1", always_on: true, is_active: true },
    ];

    // 10 kWh battery, 100% eff/dod => 10 kWh. 10 kW load => 1.0 hour runtime.
    const sim = runSimulation({
      equipment: mockEquipment,
      capacityKwh: 10,
      dodPct: 100,
      efficiencyPct: 100,
      durationH: 3,
    });

    expect(sim.timeline.length).toBe(7); // 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0
    expect(sim.depletionTimeH).toBe(1.0);
    const dropPoint = sim.timeline.find((p) => p.dropoutEvent);
    expect(dropPoint).toBeDefined();
    expect(dropPoint?.batteryPct).toBe(0);
  });
});
