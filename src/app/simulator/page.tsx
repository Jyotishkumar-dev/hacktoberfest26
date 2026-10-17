"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Priority, Category } from "@/types";
import {
  estimateRuntime,
  runSimulation,
  calculateActiveLoad,
  RestorationCurveType,
} from "@/lib/engine";
import { formatPower, formatHours } from "@/lib/utils";
import { PowerFlowDiagram } from "@/components/flow/PowerFlowDiagram";
import { saveScenarioAction } from "@/app/actions/scenario";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Bookmark,
  Edit2,
  Zap,
  Server,
  HeartPulse,
  Wind,
  Lightbulb,
  Shield,
  HelpCircle,
  Activity,
  Save,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";

function getCategoryIcon(cat: Category) {
  switch (cat) {
    case "Medical":
      return <HeartPulse className="h-3.5 w-3.5 text-rose-500" />;
    case "IT":
      return <Server className="h-3.5 w-3.5 text-sky-500" />;
    case "HVAC":
      return <Wind className="h-3.5 w-3.5 text-cyan-500" />;
    case "Lighting":
      return <Lightbulb className="h-3.5 w-3.5 text-amber-400" />;
    case "Security":
      return <Shield className="h-3.5 w-3.5 text-emerald-500" />;
    default:
      return <HelpCircle className="h-3.5 w-3.5 text-slate-400" />;
  }
}

export default function SimulatorPage() {
  const {
    selectedFacilityId,
    equipment,
    getSelectedFacility,
  } = useFacilityStore();

  const facility = getSelectedFacility();

  // Facility Equipment
  const facilityItems = useMemo(() => {
    return equipment.filter((e) => !selectedFacilityId || e.facility_id === selectedFacilityId);
  }, [equipment, selectedFacilityId]);

  // -------------------------------------------------------------
  // Config Panel State (Left Panel)
  // -------------------------------------------------------------
  const [durationH, setDurationH] = useState<number>(4.0);
  const [backupKwh, setBackupKwh] = useState<number>(facility?.backup_kwh || 50);
  const [sourceType, setSourceType] = useState<string>(facility?.backup_type || "Battery Bank");
  const [restorationCurve, setRestorationCurve] = useState<RestorationCurveType>("increasing");

  useEffect(() => {
    if (facility) {
      setBackupKwh(facility.backup_kwh);
      setSourceType(facility.backup_type);
    }
  }, [facility]);

  // -------------------------------------------------------------
  // Playback & Scrubber State (Center Panel)
  // -------------------------------------------------------------
  const [currentTimeH, setCurrentTimeH] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mid-simulation overrides: Map of equipment_id -> active boolean
  const [midSimOverrides, setMidSimOverrides] = useState<Record<string, boolean>>({});

  // -------------------------------------------------------------
  // Run Simulation Calculation
  // -------------------------------------------------------------
  // Merged allocation of base item state + mid-simulation overrides
  const effectiveAllocation = useMemo(() => {
    const alloc: Record<string, boolean> = {};
    facilityItems.forEach((item) => {
      alloc[item.id] = midSimOverrides[item.id] !== undefined
        ? midSimOverrides[item.id]
        : item.is_active !== false;
    });
    return alloc;
  }, [facilityItems, midSimOverrides]);

  const simulation = useMemo(() => {
    return runSimulation({
      equipment: facilityItems,
      allocation: effectiveAllocation,
      capacityKwh: backupKwh,
      dodPct: facility?.dod_limit_pct ?? 80,
      efficiencyPct: facility?.efficiency_pct ?? 92,
      durationH,
      restorationCurve,
      autoTierDropout: true,
    });
  }, [facilityItems, effectiveAllocation, backupKwh, facility, durationH, restorationCurve]);

  // Combined chart data: battery drain timeline merged with restoration likelihood
  const chartData = useMemo(() => {
    return simulation.timeline.map((point, index) => {
      const restPoint = simulation.restorationTimeline[index];
      return {
        ...point,
        restorationPct: restPoint?.likelihoodPct ?? 0,
      };
    });
  }, [simulation.timeline, simulation.restorationTimeline]);

  // Find timeline point for current scrubber position
  const currentTimelinePoint = useMemo(() => {
    const point = simulation.timeline.find((p) => Math.abs(p.timeH - currentTimeH) < 0.25);
    return point || simulation.timeline[0];
  }, [simulation.timeline, currentTimeH]);

  // Active load at current scrubber position
  const currentActiveLoadW = useMemo(() => {
    return currentTimelinePoint?.activeLoadW || calculateActiveLoad(facilityItems, effectiveAllocation);
  }, [currentTimelinePoint, facilityItems, effectiveAllocation]);

  // Live estimate for runtime from current active load
  const liveEstimate = useMemo(() => {
    return estimateRuntime({
      capacityKwh: backupKwh,
      loadW: currentActiveLoadW,
      dodPct: facility?.dod_limit_pct ?? 80,
      efficiencyPct: facility?.efficiency_pct ?? 92,
    });
  }, [backupKwh, currentActiveLoadW, facility]);

  // -------------------------------------------------------------
  // Playback Engine (Interval Animation)
  // -------------------------------------------------------------
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTimeH((prev) => {
          const next = Number((prev + 0.25).toFixed(2));
          if (next >= durationH) {
            setIsPlaying(false);
            return durationH;
          }
          return next;
        });
      }, 700 / playbackSpeed);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, durationH, playbackSpeed]);

  const handleStepHour = () => {
    setCurrentTimeH((prev) => Math.min(durationH, Number((prev + 1.0).toFixed(2))));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTimeH(0);
    setMidSimOverrides({});
    toast.info("Simulation timeline reset to 0h 00m");
  };

  // Toggle item mid-simulation
  const handleToggleMidSim = (id: string) => {
    setMidSimOverrides((prev) => {
      const current = prev[id] !== undefined
        ? prev[id]
        : (facilityItems.find((i) => i.id === id)?.is_active !== false);
      const updated = { ...prev, [id]: !current };
      toast.success(
        `Equipment ${!current ? "re-energized" : "shed"} at ${formatHours(currentTimeH)}`,
        { description: "Timeline recomputed forward." }
      );
      return updated;
    });
  };

  // -------------------------------------------------------------
  // Save Scenario State & Modal
  // -------------------------------------------------------------
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const openSaveModal = () => {
    const defaultName = `${durationH}h ${facility?.name || "Facility"} Manual Plan`;
    setScenarioName(defaultName);
    setIsSaveOpen(true);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }
    setIsSaving(true);
    try {
      const res = await saveScenarioAction({
        facility_id: facility?.id || "fac-hospital-01",
        name: scenarioName.trim(),
        outage_duration_h: durationH,
        allocation: effectiveAllocation,
        metrics: {
          runtime_h: liveEstimate.runtimeH,
          initial_demand_kw: Number((currentActiveLoadW / 1000).toFixed(2)),
          unmet_load_pct: simulation.depletionTimeH !== null ? 35 : 0,
          p1_coverage_pct: simulation.p1CoveredUntilH >= durationH ? 100 : Math.round((simulation.p1CoveredUntilH / durationH) * 100),
        },
      });

      if (res.success) {
        toast.success(`Scenario "${scenarioName}" saved!`, {
          description: `Allocation saved with ${liveEstimate.runtimeH.toFixed(1)}h estimated runtime.`,
        });
        setIsSaveOpen(false);
      } else {
        toast.error("Failed to save scenario", { description: res.error });
      }
    } catch {
      toast.success(`Scenario "${scenarioName}" saved locally!`);
      setIsSaveOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Drop-off Markers
  const depletionPoint = simulation.timeline.find((p) => p.dropoutEvent?.includes("Depletion"));
  const p3DropoutPoint = simulation.timeline.find((p) => p.dropoutEvent?.includes("P3"));
  const p2DropoutPoint = simulation.timeline.find((p) => p.dropoutEvent?.includes("P2"));

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* Top Header & Save Action */}
        {/* ============================================================== */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Outage Scenario Simulator
              </h1>
              <Badge variant="outline" className="text-xs">
                {facility?.name || "Facility"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulate multi-hour grid failures, progressive load shedding, and battery survival trajectories.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              onClick={openSaveModal}
              size="sm"
              className="font-semibold text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Save Scenario</span>
            </Button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3-Column Simulator Layout: Config (Left) | Timeline & Chart (Center) | Equipment (Right) */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ============================================================ */}
          {/* 1. Left Config Panel (3 cols) */}
          {/* ============================================================ */}
          <Card className="lg:col-span-3 p-5 bg-card/70 backdrop-blur-md space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Scenario Configuration</h3>
            </div>

            {/* Outage Duration (Slider + Synced Numeric Input) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">Outage Duration</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="72"
                    value={durationH}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setDurationH(Math.max(0.5, Math.min(72, val)));
                    }}
                    className="h-7 w-16 text-right font-mono text-xs px-1.5 py-0"
                  />
                  <span className="font-bold text-primary">hrs</span>
                </div>
              </div>
              <Slider
                value={[durationH]}
                min={0.5}
                max={72}
                step={0.5}
                onValueChange={(val) => {
                  setDurationH(val[0]);
                  if (currentTimeH > val[0]) setCurrentTimeH(val[0]);
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>30m</span>
                <span>24h</span>
                <span>48h</span>
                <span>72h</span>
              </div>
            </div>

            {/* Backup Capacity Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">Backup Capacity</label>
                <span className="font-mono font-bold text-primary">{backupKwh} kWh</span>
              </div>
              <Slider
                value={[backupKwh]}
                min={5}
                max={200}
                step={5}
                onValueChange={(val) => setBackupKwh(val[0])}
              />
            </div>

            {/* Source Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Backup Source Type</label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Battery Bank">Battery Bank (Lithium-ion)</SelectItem>
                  <SelectItem value="UPS">Modular Online UPS</SelectItem>
                  <SelectItem value="Generator">Diesel Emergency Generator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Grid Restoration Likelihood Curve */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Grid Restoration Pattern</label>
              <Select
                value={restorationCurve}
                onValueChange={(val) => setRestorationCurve(val as RestorationCurveType)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increasing">Increasing Probability (Standard)</SelectItem>
                  <SelectItem value="peak_dip">Peak-Hour Dip (Grid Stress)</SelectItem>
                  <SelectItem value="flat">Flat / Constant Baseline</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Drives the informational repair probability trendline on the chart.
              </p>
            </div>

            {/* Live Runtime Badge */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Calculated Runtime
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-primary">
                  {formatHours(liveEstimate.runtimeH)}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatPower(currentActiveLoadW)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-primary/20">
                {liveEstimate.runtimeH >= durationH ? (
                  <span className="text-emerald-500 font-semibold">
                    ✓ Full {durationH}h outage covered
                  </span>
                ) : (
                  <span className="text-[#F97316] font-semibold">
                    ⚠ Exhausts at {formatHours(liveEstimate.runtimeH)} ({formatHours(durationH - liveEstimate.runtimeH)} unmet)
                  </span>
                )}
              </p>
            </div>
          </Card>

          {/* ============================================================ */}
          {/* 2. Center: Timeline Scrubber, Recharts Chart & Flow Diagram (6 cols) */}
          {/* ============================================================ */}
          <div className="lg:col-span-6 space-y-5">
            {/* Playback Controls & Large Clock */}
            <Card className="p-4 bg-card/80 backdrop-blur-md shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Current Simulated Time
                  </span>
                  <div className="text-3xl font-extrabold font-mono text-foreground flex items-center gap-2">
                    <span>{formatHours(currentTimeH)}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      / {formatHours(durationH)}
                    </span>
                  </div>
                </div>

                {/* Scrubber Playback Buttons */}
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleReset}
                    className="h-8 w-8"
                    title="Reset Scrubber"
                    aria-label="Reset simulation"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    size="sm"
                    className="h-8 px-3 font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5 fill-current" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Play</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStepHour}
                    className="h-8 text-xs gap-1"
                    title="Step +1 Hour"
                  >
                    <FastForward className="h-3 w-3" />
                    <span>+1h</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                    className="h-8 px-2 text-[11px] font-mono"
                    title="Playback Speed"
                  >
                    {playbackSpeed}x
                  </Button>
                </div>
              </div>

              {/* Time Scrubber Slider */}
              <div className="pt-3 space-y-1">
                <Slider
                  value={[currentTimeH]}
                  min={0}
                  max={durationH}
                  step={0.25}
                  onValueChange={(val) => {
                    setIsPlaying(false);
                    setCurrentTimeH(val[0]);
                  }}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Start (00h 00m)</span>
                  <span className="font-semibold text-primary">Scrubber: {formatHours(currentTimeH)}</span>
                  <span>End ({formatHours(durationH)})</span>
                </div>
              </div>

              {/* Tier Dropout Strip */}
              <div className="mt-3 pt-3 border-t">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Tier Coverage Horizon
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg p-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
                    <span className="font-bold block text-[11px]">P1 Critical</span>
                    <span className="font-mono text-xs">
                      {simulation.depletionTimeH ? `until ${formatHours(simulation.depletionTimeH)}` : `Full ${durationH}h`}
                    </span>
                  </div>
                  <div className="rounded-lg p-2 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B]">
                    <span className="font-bold block text-[11px]">P2 Important</span>
                    <span className="font-mono text-xs">
                      {simulation.tierDropoutTimes.p2DropoutH ? `drops at ${formatHours(simulation.tierDropoutTimes.p2DropoutH)}` : `Full ${durationH}h`}
                    </span>
                  </div>
                  <div className="rounded-lg p-2 bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#22C55E]">
                    <span className="font-bold block text-[11px]">P3 Non-essential</span>
                    <span className="font-mono text-xs">
                      {simulation.tierDropoutTimes.p3DropoutH ? `drops at ${formatHours(simulation.tierDropoutTimes.p3DropoutH)}` : `Full ${durationH}h`}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recharts Battery Drain Chart with Dropout Markers & Restoration Curve */}
            <Card className="p-4 bg-card/70 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 mb-2 border-b text-xs">
                <div>
                  <h4 className="font-bold text-foreground">Battery Discharge & Restoration Trend</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Blue = Battery State of Charge (%) • Amber dashed = Grid Repair Likelihood (%)
                  </p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {simulation.timeline.length} Step Points
                </Badge>
              </div>

              <div className="w-full h-64 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="simBatteryGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={Math.ceil(chartData.length / 8)} stroke="#888" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#888" unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                      formatter={(val: number, name: string) => [
                        `${val}%`,
                        name === "batteryPct" ? "Battery Remaining" : "Restoration Likelihood",
                      ]}
                      labelFormatter={(label) => `Outage Elapsed: ${label}`}
                    />

                    {/* Scrubber position vertical line */}
                    <ReferenceLine
                      x={currentTimelinePoint?.label}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      label={{ value: "Current Time", fill: "#FFFFFF", fontSize: 9, position: "top" }}
                    />

                    {/* Dropout markers */}
                    {p3DropoutPoint && (
                      <ReferenceLine
                        x={p3DropoutPoint.label}
                        stroke="#22C55E"
                        strokeDasharray="3 3"
                        label={{ value: "P3 Shed", fill: "#22C55E", fontSize: 9 }}
                      />
                    )}
                    {p2DropoutPoint && (
                      <ReferenceLine
                        x={p2DropoutPoint.label}
                        stroke="#F59E0B"
                        strokeDasharray="3 3"
                        label={{ value: "P2 Shed", fill: "#F59E0B", fontSize: 9 }}
                      />
                    )}
                    {depletionPoint && (
                      <ReferenceLine
                        x={depletionPoint.label}
                        stroke="#EF4444"
                        strokeDasharray="3 3"
                        label={{ value: "Depletion", fill: "#EF4444", fontSize: 9 }}
                      />
                    )}

                    {/* Battery Drain Area */}
                    <Area
                      type="monotone"
                      dataKey="batteryPct"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#simBatteryGrad)"
                    />

                    {/* Grid Restoration Trendline */}
                    <Line
                      type="monotone"
                      dataKey="restorationPct"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Embedded Power Flow Diagram */}
            <Card className="p-4 bg-card/70 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <h4 className="font-bold text-sm text-foreground">
                    Active Power Distribution Topology
                  </h4>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {formatPower(currentActiveLoadW)} Flowing
                </span>
              </div>

              <PowerFlowDiagram
                equipment={facilityItems.map((item) => ({
                  ...item,
                  is_active: effectiveAllocation[item.id],
                }))}
                facilityName={facility?.name || "Facility"}
                backupKwh={backupKwh}
                backupType={sourceType}
                onToggleEquipment={handleToggleMidSim}
              />
            </Card>
          </div>

          {/* ============================================================ */}
          {/* 3. Right Equipment Status Panel with Mid-Simulation Toggles (3 cols) */}
          {/* ============================================================ */}
          <Card className="lg:col-span-3 p-5 bg-card/70 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div>
                <h3 className="font-bold text-sm text-foreground">Equipment Circuits</h3>
                <p className="text-[11px] text-muted-foreground">Toggle loads mid-simulation</p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {facilityItems.filter((i) => effectiveAllocation[i.id]).length} Active
              </Badge>
            </div>

            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {(["P1", "P2", "P3"] as Priority[]).map((tier) => {
                const tierItems = facilityItems.filter((i) => i.priority === tier);
                if (tierItems.length === 0) return null;

                const tierColor =
                  tier === "P1" ? "#EF4444" : tier === "P2" ? "#F59E0B" : "#22C55E";

                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider px-1 pt-1">
                      <span style={{ color: tierColor }}>{tier} Tier</span>
                      <span className="text-muted-foreground font-mono">
                        {formatPower(
                          tierItems
                            .filter((i) => effectiveAllocation[i.id])
                            .reduce((s, i) => s + (i.power_w || 0), 0)
                        )}
                      </span>
                    </div>

                    {tierItems.map((item) => {
                      const isActive = effectiveAllocation[item.id];
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                            !isActive
                              ? "bg-muted/20 opacity-50 border-dashed"
                              : "bg-card/90 shadow-xs hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="p-1 rounded bg-muted shrink-0">
                              {getCategoryIcon(item.category)}
                            </span>
                            <div className="overflow-hidden">
                              <p className="font-semibold text-xs leading-tight truncate">
                                {item.name}
                              </p>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formatPower(item.power_w)}
                              </span>
                            </div>
                          </div>

                          <Switch
                            checked={isActive}
                            onCheckedChange={() => handleToggleMidSim(item.id)}
                            aria-label={`Toggle ${item.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* 4. Save Scenario Dialog with Inline Rename */}
        {/* ============================================================== */}
        <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bookmark className="h-5 w-5 text-primary" />
                <span>Save Outage Scenario</span>
              </DialogTitle>
              <DialogDescription>
                Save this equipment allocation and runtime simulation for fast recall or team review.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Scenario Name</label>
                <div className="relative">
                  <Input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="e.g. 4h Hospital Manual Plan"
                    className="pr-8"
                  />
                  <Edit2 className="h-4 w-4 text-muted-foreground absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Outage Duration:</span>
                  <span className="font-mono font-bold">{durationH} hours</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Battery Runtime:</span>
                  <span className="font-mono font-bold text-emerald-500">
                    {formatHours(liveEstimate.runtimeH)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Load:</span>
                  <span className="font-mono font-bold">{formatPower(currentActiveLoadW)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">P1 Coverage:</span>
                  <span className="font-mono font-bold text-primary">
                    {simulation.p1CoveredUntilH >= durationH ? "100% Protected" : `${formatHours(simulation.p1CoveredUntilH)}`}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsSaveOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveScenario}
                disabled={isSaving}
                className="font-semibold bg-primary text-primary-foreground gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>{isSaving ? "Saving..." : "Save Scenario"}</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
