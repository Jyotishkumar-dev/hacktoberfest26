"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Priority, Category } from "@/types";
import { estimateRuntime, sensitivityTable, runSimulation, calculateActiveLoad } from "@/lib/engine";
import { formatPower, formatHours } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Zap,
  Battery,
  Clock,
  AlertTriangle,
  Flame,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  HeartPulse,
  Server,
  Wind,
  Lightbulb,
  Shield,
  HelpCircle,
  TrendingUp,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
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
      return <HeartPulse className="h-4 w-4 text-rose-500" />;
    case "IT":
      return <Server className="h-4 w-4 text-sky-500" />;
    case "HVAC":
      return <Wind className="h-4 w-4 text-cyan-500" />;
    case "Lighting":
      return <Lightbulb className="h-4 w-4 text-amber-400" />;
    case "Security":
      return <Shield className="h-4 w-4 text-emerald-500" />;
    default:
      return <HelpCircle className="h-4 w-4 text-slate-400" />;
  }
}

export default function DashboardPage() {
  const {
    selectedFacilityId,
    equipment,
    getSelectedFacility,
    toggleEquipmentActive,
    shedAllP3,
    lastUpdated,
    setLastUpdated,
  } = useFacilityStore();

  const facility = getSelectedFacility();

  // Filter equipment for the selected facility
  const facilityItems = useMemo(() => {
    return equipment.filter((e) => !selectedFacilityId || e.facility_id === selectedFacilityId);
  }, [equipment, selectedFacilityId]);

  // Dynamic Estimator overrides (for what-if exploration drawer/tab)
  const [customCapacity, setCustomCapacity] = useState<number>(facility?.backup_kwh || 50);
  const [customDod, setCustomDod] = useState<number>(facility?.dod_limit_pct || 80);
  const [customEff, setCustomEff] = useState<number>(facility?.efficiency_pct || 92);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Keep custom controls synced when facility switches
  useEffect(() => {
    if (facility) {
      setCustomCapacity(facility.backup_kwh);
      setCustomDod(facility.dod_limit_pct);
      setCustomEff(facility.efficiency_pct);
    }
  }, [facility]);

  // Auto-refresh simulated state every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date().toLocaleTimeString());
    }, 30000);
    return () => clearInterval(interval);
  }, [setLastUpdated]);

  // Active loads
  const currentActiveLoadW = useMemo(() => {
    return calculateActiveLoad(facilityItems);
  }, [facilityItems]);

  // Current live estimate using facility specs
  const liveEstimate = useMemo(() => {
    return estimateRuntime({
      capacityKwh: customCapacity,
      loadW: currentActiveLoadW,
      dodPct: customDod,
      efficiencyPct: customEff,
    });
  }, [customCapacity, currentActiveLoadW, customDod, customEff]);

  // Sensitivity table for the current equipment configuration
  const sensitivity = useMemo(() => {
    return sensitivityTable(facilityItems, {
      capacityKwh: customCapacity,
      dodPct: customDod,
      efficiencyPct: customEff,
    });
  }, [facilityItems, customCapacity, customDod, customEff]);

  // Calculate "Next Best Action": P3 Shedding impact
  const activeP3Items = facilityItems.filter(
    (item) => item.priority === "P3" && item.is_active !== false
  );
  const p3LoadW = activeP3Items.reduce((acc, curr) => acc + (curr.power_w || 0), 0);
  const loadWithoutP3 = Math.max(0, currentActiveLoadW - p3LoadW);
  const estimateWithoutP3 = estimateRuntime({
    capacityKwh: customCapacity,
    loadW: loadWithoutP3,
    dodPct: customDod,
    efficiencyPct: customEff,
  });

  const p3RuntimeGainHours = Math.max(0, estimateWithoutP3.runtimeH - liveEstimate.runtimeH);

  // Simulation run for Recharts AreaChart (8 hours timeline)
  const simulation = useMemo(() => {
    return runSimulation({
      equipment: facilityItems,
      capacityKwh: customCapacity,
      dodPct: customDod,
      efficiencyPct: customEff,
      durationH: 8,
    });
  }, [facilityItems, customCapacity, customDod, customEff]);

  // Battery gauge color token logic:
  // Battery <30%: orange #F97316, <10%: red #DC2626
  const simulatedBatteryPct = 100;
  const batteryColorClass =
    simulatedBatteryPct < 10
      ? "text-[#DC2626]"
      : simulatedBatteryPct < 30
      ? "text-[#F97316]"
      : "text-emerald-500";

  // Runtime warning: < 2 hours turns orange (#F97316)
  const isRuntimeCritical = liveEstimate.runtimeH < 2.0;

  const handleShedAllP3 = () => {
    const res = shedAllP3();
    if (res.count > 0) {
      toast.warning(`Shed ${res.count} P3 non-essential items!`, {
        description: `Saved ${formatPower(res.savedWatts)}. Runtime extended by ${formatHours(p3RuntimeGainHours)}.`,
      });
    } else {
      toast.info("All P3 equipment items are already shed.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* Top Header & Simulation Clock */}
        {/* ============================================================== */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Facility Command Center
              </h1>
              <span className="rounded-full bg-emerald-500/10 text-emerald-500 px-2.5 py-0.5 text-xs font-semibold">
                Simulated Grid Offline
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active facility: <span className="font-semibold text-foreground">{facility?.name || "None"}</span> • {facility?.backup_kwh} kWh {facility?.backup_type}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/50 px-3 py-1.5 rounded-lg border">
              <RefreshCw className="h-3 w-3 text-primary animate-pulse" />
              <span>Simulated cycle: Auto-refresh</span>
              <span className="font-semibold text-foreground">({lastUpdated})</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Critical Warning Banner if Runtime < 2h */}
        {/* ============================================================== */}
        {isRuntimeCritical && (
          <div className="flex items-center justify-between rounded-xl border border-[#F97316]/40 bg-[#F97316]/10 p-4 text-[#F97316] animate-pulse-slow shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F97316]/20 shrink-0">
                <AlertTriangle className="h-6 w-6 text-[#F97316]" />
              </div>
              <div>
                <h4 className="font-bold text-sm">
                  Runtime under 2 hours: consider shedding P3 equipment
                </h4>
                <p className="text-xs opacity-90">
                  Current battery drain rate ({formatPower(currentActiveLoadW)}) will exhaust reserves in {formatHours(liveEstimate.runtimeH)}.
                </p>
              </div>
            </div>

            {activeP3Items.length > 0 && (
              <Button
                size="sm"
                onClick={handleShedAllP3}
                className="bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold shadow-sm shrink-0 gap-1.5"
              >
                <Flame className="h-4 w-4" />
                <span>Shed {activeP3Items.length} P3 Now (+{formatHours(p3RuntimeGainHours)})</span>
              </Button>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* Hero KPI Strip: 4 Large Cards */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Total Demand */}
          <Card className="bg-card/70 backdrop-blur-md border-border/80 shadow-sm relative overflow-hidden">
            <div className="absolute right-3 top-3 rounded-full bg-blue-500/10 p-2.5 text-blue-500">
              <Zap className="h-5 w-5" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Total Demand
              </CardDescription>
              <CardTitle className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {(currentActiveLoadW / 1000).toFixed(2)}{" "}
                <span className="text-base font-normal text-muted-foreground">kW</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {facilityItems.filter((i) => i.is_active !== false).length} of {facilityItems.length} equipment items active
              </p>
            </CardContent>
          </Card>

          {/* 2. Usable Backup */}
          <Card className="bg-card/70 backdrop-blur-md border-border/80 shadow-sm relative overflow-hidden">
            <div className="absolute right-3 top-3 rounded-full bg-emerald-500/10 p-2.5 text-emerald-500">
              <Battery className="h-5 w-5" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Usable Backup
              </CardDescription>
              <CardTitle className="text-3xl font-bold font-mono tracking-tight text-foreground">
                {liveEstimate.usableKwh.toFixed(1)}{" "}
                <span className="text-base font-normal text-muted-foreground">kWh</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground">
                {customCapacity} kWh × {customDod}% DoD × {customEff}% Eff
              </p>
            </CardContent>
          </Card>

          {/* 3. Battery Level */}
          <Card className="bg-card/70 backdrop-blur-md border-border/80 shadow-sm relative overflow-hidden">
            <div className={`absolute right-3 top-3 rounded-full bg-muted p-2.5 ${batteryColorClass}`}>
              <Battery className="h-5 w-5" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Battery Level
              </CardDescription>
              <CardTitle className={`text-3xl font-bold font-mono tracking-tight ${batteryColorClass}`}>
                {simulatedBatteryPct}%
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden mb-1.5">
                <div
                  className="h-full bg-emerald-500 transition-all rounded-full"
                  style={{ width: `${simulatedBatteryPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Optimal state of charge (SoC)
              </p>
            </CardContent>
          </Card>

          {/* 4. Estimated Runtime */}
          <Card
            className={`bg-card/70 backdrop-blur-md shadow-sm relative overflow-hidden transition-colors ${
              isRuntimeCritical
                ? "border-[#F97316] bg-[#F97316]/5"
                : "border-border/80"
            }`}
          >
            <div
              className={`absolute right-3 top-3 rounded-full p-2.5 ${
                isRuntimeCritical
                  ? "bg-[#F97316]/15 text-[#F97316]"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Clock className="h-5 w-5" />
            </div>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-medium uppercase tracking-wider">
                Estimated Runtime
              </CardDescription>
              <CardTitle
                className={`text-3xl font-bold font-mono tracking-tight ${
                  isRuntimeCritical ? "text-[#F97316]" : "text-foreground"
                }`}
              >
                {formatHours(liveEstimate.runtimeH)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-[11px] font-mono text-muted-foreground truncate">
                ({liveEstimate.usableKwh.toFixed(1)} kWh × 1000) / {currentActiveLoadW} W
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ============================================================== */}
        {/* Prominent "Next Best Action" Card (Above the fold decision support) */}
        {/* ============================================================== */}
        <Card className="border-primary/40 bg-gradient-to-r from-primary/10 via-card to-card p-5 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider">
                  Next Best Action
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Instant decision support
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground">
                {activeP3Items.length > 0 ? (
                  <span>
                    Shedding {activeP3Items.length} P3 non-essential items extends runtime from{" "}
                    <span className="text-[#F97316] font-mono">{formatHours(liveEstimate.runtimeH)}</span> to{" "}
                    <span className="text-[#22C55E] font-mono">{formatHours(estimateWithoutP3.runtimeH)}</span>
                  </span>
                ) : (
                  <span>
                    All P3 non-essential items are shed. System running in maximum runtime preservation mode.
                  </span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">
                P3 items represent {formatPower(p3LoadW)} of non-critical load (Cafeteria cooling, open area lighting, AC comfort).
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button
                onClick={handleShedAllP3}
                disabled={activeP3Items.length === 0}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2"
              >
                <Flame className="h-4 w-4" />
                <span>Shed all P3 ({activeP3Items.length})</span>
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>

        {/* ============================================================== */}
        {/* Tab Navigation: Command Overview vs Estimator & Sensitivity */}
        {/* ============================================================== */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <TabsList className="bg-muted/60 p-1">
              <TabsTrigger value="overview" className="text-xs font-semibold gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                <span>Equipment & Drain Timeline</span>
              </TabsTrigger>
              <TabsTrigger value="estimator" className="text-xs font-semibold gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Backup Runtime Estimator & Sensitivity</span>
              </TabsTrigger>
            </TabsList>

            {/* Core formula teaser */}
            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 px-3 py-1 rounded-md border">
              <span className="font-semibold text-foreground">Runtime (h)</span> = (Capacity_kWh × DoD × Efficiency) / Load_kW
            </div>
          </div>

          {/* ============================================================== */}
          {/* TAB 1: Overview - Equipment Toggle Grid & Drain Mini-Chart */}
          {/* ============================================================== */}
          <TabsContent value="overview" className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Equipment Status List with instant on/off toggles (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-foreground">
                      Equipment Live Allocation
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Toggle items on/off to instantly recalculate battery runtime.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-mono">
                    {formatPower(currentActiveLoadW)} Active
                  </Badge>
                </div>

                {/* Grouped by Tier */}
                {(["P1", "P2", "P3"] as Priority[]).map((tier) => {
                  const itemsInTier = facilityItems.filter((i) => i.priority === tier);
                  if (itemsInTier.length === 0) return null;

                  const tierBorder =
                    tier === "P1"
                      ? "border-l-4 border-l-[#EF4444]"
                      : tier === "P2"
                      ? "border-l-4 border-l-[#F59E0B]"
                      : "border-l-4 border-l-[#22C55E]";

                  const tierTitle =
                    tier === "P1" ? "P1 Critical" : tier === "P2" ? "P2 Important" : "P3 Non-essential";

                  const tierActiveW = itemsInTier
                    .filter((i) => i.is_active !== false)
                    .reduce((sum, item) => sum + (item.power_w || 0), 0);

                  return (
                    <Card key={tier} className={`overflow-hidden ${tierBorder}`}>
                      <div className="flex items-center justify-between bg-muted/40 px-4 py-2.5 border-b">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs uppercase tracking-wide">
                            {tierTitle}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            ({itemsInTier.length} items)
                          </span>
                        </div>
                        <span className="font-mono text-xs font-semibold">
                          {formatPower(tierActiveW)}
                        </span>
                      </div>

                      <div className="divide-y divide-border">
                        {itemsInTier.map((item) => {
                          const isActive = item.is_active !== false;
                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between px-4 py-3 transition-colors ${
                                !isActive ? "bg-muted/30 opacity-60" : "hover:bg-muted/10"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="p-1 rounded bg-muted/80 inline-flex items-center justify-center">
                                  {getCategoryIcon(item.category)}
                                </span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-sm text-foreground">
                                      {item.name}
                                    </span>
                                    {item.always_on && (
                                      <Badge variant="outline" className="text-[9px] py-0 px-1 border-rose-500/40 text-rose-500">
                                        Always On
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground">
                                    {item.category} • {item.notes || "Standard load"}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {formatPower(item.power_w)}
                                </span>
                                <Switch
                                  checked={isActive}
                                  onCheckedChange={() => toggleEquipmentActive(item.id)}
                                  aria-label={`Toggle ${item.name}`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Right Column: Battery Drain Mini-Chart (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 flex flex-col h-full bg-card/70 backdrop-blur-md">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">
                        Battery Drain Curve
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Simulated discharge trajectory at current {formatPower(currentActiveLoadW)} load
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      8 Hour Horizon
                    </Badge>
                  </div>

                  <div className="w-full h-64 sm:h-72 pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={simulation.timeline}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval={1}
                          stroke="#888888"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 10 }}
                          stroke="#888888"
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "0.5rem",
                            fontSize: "12px",
                          }}
                          formatter={(val: number) => [`${val}%`, "Battery Remaining"]}
                          labelFormatter={(label) => `Elapsed: ${label}`}
                        />
                        <ReferenceLine
                          y={30}
                          stroke="#F97316"
                          strokeDasharray="4 4"
                          label={{ value: "30% Reserve", fill: "#F97316", fontSize: 10 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="batteryPct"
                          stroke="#3B82F6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#batteryGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-4 pt-3 border-t text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Depletion Moment:</span>
                      <span className="font-mono font-bold text-foreground">
                        {simulation.depletionTimeH !== null
                          ? `at ${simulation.depletionTimeH} hours`
                          : "Survives full 8h horizon"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Usable Energy:</span>
                      <span className="font-mono font-bold text-foreground">
                        {liveEstimate.usableKwh.toFixed(2)} kWh
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">P1 Protected Hours:</span>
                      <span className="font-mono font-bold text-emerald-500">
                        {formatHours(liveEstimate.runtimeH)}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ============================================================== */}
          {/* TAB 2: Backup Runtime Estimator Panel & Sensitivity Table */}
          {/* ============================================================== */}
          <TabsContent value="estimator" className="space-y-6 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Interactive Param Sliders (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="p-5 bg-card/70 backdrop-blur-md">
                  <div className="flex items-center gap-2 pb-3 border-b mb-4">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm text-foreground">
                      Battery Specs & Live Overrides
                    </h3>
                  </div>

                  <div className="space-y-5">
                    {/* Capacity Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">Nameplate Capacity</label>
                        <span className="font-mono font-bold text-primary">{customCapacity} kWh</span>
                      </div>
                      <Slider
                        value={[customCapacity]}
                        min={5}
                        max={200}
                        step={5}
                        onValueChange={(val) => setCustomCapacity(val[0])}
                      />
                    </div>

                    {/* DoD Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">Depth of Discharge (DoD)</label>
                        <span className="font-mono font-bold text-primary">{customDod}%</span>
                      </div>
                      <Slider
                        value={[customDod]}
                        min={50}
                        max={100}
                        step={1}
                        onValueChange={(val) => setCustomDod(val[0])}
                      />
                    </div>

                    {/* Efficiency Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold text-foreground">Inverter / Round-Trip Efficiency</label>
                        <span className="font-mono font-bold text-primary">{customEff}%</span>
                      </div>
                      <Slider
                        value={[customEff]}
                        min={70}
                        max={98}
                        step={1}
                        onValueChange={(val) => setCustomEff(val[0])}
                      />
                    </div>

                    {/* Active Load summary */}
                    <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1 border">
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Current Active Demand:</span>
                        <span className="font-mono font-bold">{formatPower(currentActiveLoadW)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Usable kWh Output:</span>
                        <span className="font-mono font-bold text-emerald-500">
                          {liveEstimate.usableKwh.toFixed(2)} kWh
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Inline Formula with Substituted Numbers */}
                <Card className="p-5 bg-card/70 border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-bold text-xs uppercase tracking-wide text-foreground">
                      Core Runtime Equation (Live Substituted)
                    </h4>
                  </div>
                  <div className="rounded-lg bg-background p-3 font-mono text-xs text-foreground border leading-relaxed space-y-2">
                    <p className="text-muted-foreground">
                      Runtime (h) = (Capacity_kWh × DoD% × Efficiency% × 1000) / Load_W
                    </p>
                    <p className="font-bold text-primary">
                      Runtime = ({customCapacity} × {customDod / 100} × {customEff / 100} × 1000) / {currentActiveLoadW || 1}
                    </p>
                    <p className="text-sm font-bold text-emerald-500 pt-1 border-t">
                      = {formatHours(liveEstimate.runtimeH)} ({liveEstimate.runtimeH.toFixed(2)} decimal hours)
                    </p>
                  </div>
                </Card>
              </div>

              {/* Right Column: Sensitivity Table (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 bg-card/70 backdrop-blur-md">
                  <div className="flex items-center justify-between pb-3 border-b mb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <h3 className="font-bold text-sm text-foreground">
                        Category Sensitivity Analysis
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Ranked by highest runtime extension
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    See exactly how much battery endurance is gained if each equipment group is shedded during an outage.
                  </p>

                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="text-xs">Category</TableHead>
                          <TableHead className="text-xs text-right">Items</TableHead>
                          <TableHead className="text-xs text-right">Group Load</TableHead>
                          <TableHead className="text-xs text-right">New Runtime</TableHead>
                          <TableHead className="text-xs text-right font-bold text-emerald-500">
                            Gain if Shed
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sensitivity.map((row) => (
                          <TableRow key={row.category} className="hover:bg-muted/20">
                            <TableCell className="font-semibold text-xs flex items-center gap-2">
                              {getCategoryIcon(row.category)}
                              <span>{row.category}</span>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {row.itemCount}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {formatPower(row.totalLoadW)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {formatHours(row.newRuntimeH)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-emerald-500">
                              +{formatHours(row.runtimeGainH)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
