"use client";

import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Scenario } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatHours, formatPower } from "@/lib/utils";
import {
  Trophy,
  Download,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { toast } from "sonner";
import Link from "next/link";

export default function ComparePage() {
  const {
    scenarios,
    getSelectedFacility,
    getFacilityEquipment,
    generateSampleScenariosForFacility,
  } = useFacilityStore();

  const facility = getSelectedFacility();
  const facilityEquipment = getFacilityEquipment();

  // Filter scenarios for currently selected facility
  const facilityScenarios = useMemo(() => {
    if (!facility) return [];
    return scenarios.filter(
      (s) => s.facility_id === facility.id || !s.facility_id || s.facility_id === "fac-hospital-01"
    );
  }, [scenarios, facility]);

  // Selected scenarios (up to 3)
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    return facilityScenarios.slice(0, 3).map((s) => s.id);
  });

  // Keep selectedIds updated if facility changes
  React.useEffect(() => {
    if (facilityScenarios.length >= 2) {
      // Pick first 3
      setSelectedIds(facilityScenarios.slice(0, 3).map((s) => s.id));
    }
  }, [facility?.id, facilityScenarios]);

  const activeScenarios: Scenario[] = useMemo(() => {
    return selectedIds
      .map((id) => facilityScenarios.find((s) => s.id === id))
      .filter((s): s is Scenario => Boolean(s));
  }, [selectedIds, facilityScenarios]);

  // Handler to generate 3 sample strategies
  const handleGenerateSamples = () => {
    if (!facility) return;
    const generated = generateSampleScenariosForFacility(facility.id);
    setSelectedIds(generated.map((s) => s.id));
    toast.success("Generated 3 sample strategies for comparison!", {
      description: "Baseline (All-On), Balanced (P1+P2), and Max Endurance (P1-Only).",
    });
  };

  // Determine winners per metric
  const winners = useMemo(() => {
    if (activeScenarios.length === 0) return null;

    let longestRuntime = activeScenarios[0];
    let highestP1 = activeScenarios[0];
    let lowestLoad = activeScenarios[0];

    for (const sc of activeScenarios) {
      if (sc.metrics.runtime_h > longestRuntime.metrics.runtime_h) {
        longestRuntime = sc;
      }
      if (sc.metrics.p1_coverage_pct > highestP1.metrics.p1_coverage_pct) {
        highestP1 = sc;
      }
      if (sc.metrics.initial_demand_kw < lowestLoad.metrics.initial_demand_kw) {
        lowestLoad = sc;
      }
    }

    return {
      runtimeId: longestRuntime.id,
      p1Id: highestP1.id,
      loadId: lowestLoad.id,
      longestRuntime,
      highestP1,
      lowestLoad,
    };
  }, [activeScenarios]);

  // Plain-English Verdict Generator
  const verdictText = useMemo(() => {
    if (activeScenarios.length < 2) {
      return "Select at least 2 scenarios to generate an operational tradeoff verdict.";
    }

    const sortedByRuntime = [...activeScenarios].sort(
      (a, b) => b.metrics.runtime_h - a.metrics.runtime_h
    );
    const best = sortedByRuntime[0];
    const shortest = sortedByRuntime[sortedByRuntime.length - 1];

    const diffH = best.metrics.runtime_h - shortest.metrics.runtime_h;
    const diffHours = Math.floor(diffH);
    const diffMinutes = Math.round((diffH - diffHours) * 60);

    const timeDiffStr =
      diffHours > 0
        ? `${diffHours}h ${diffMinutes}m`
        : `${diffMinutes} minutes`;

    if (best.metrics.p1_coverage_pct === 100) {
      return `"${best.name}" lasts ${timeDiffStr} longer than "${shortest.name}" while keeping 100% of P1 critical life-safety circuits fully energized.`;
    } else {
      return `"${best.name}" extends backup runtime by ${timeDiffStr}, with ${best.metrics.p1_coverage_pct}% P1 coverage vs ${shortest.metrics.p1_coverage_pct}% on ${shortest.name}.`;
    }
  }, [activeScenarios]);

  // Export comparison as CSV
  const handleExportCSV = () => {
    if (activeScenarios.length === 0) {
      toast.error("No scenarios selected for export.");
      return;
    }

    const headers = [
      "Equipment Name",
      "Category",
      "Priority",
      "Power (W)",
      ...activeScenarios.map((s) => `"${s.name} (Active)"`),
    ];

    const rows = facilityEquipment.map((eq) => {
      const row = [
        `"${eq.name.replace(/"/g, '""')}"`,
        eq.category,
        eq.priority,
        eq.power_w,
        ...activeScenarios.map((s) => (s.allocation[eq.id] !== false ? "ON" : "SHED")),
      ];
      return row.join(",");
    });

    // Metric Summary rows
    const metricRuntime = [
      "--- METRIC: Runtime (h) ---",
      "-",
      "-",
      "-",
      ...activeScenarios.map((s) => s.metrics.runtime_h.toFixed(2)),
    ].join(",");

    const metricP1 = [
      "--- METRIC: P1 Coverage (%) ---",
      "-",
      "-",
      "-",
      ...activeScenarios.map((s) => s.metrics.p1_coverage_pct),
    ].join(",");

    const metricDemand = [
      "--- METRIC: Initial Demand (kW) ---",
      "-",
      "-",
      "-",
      ...activeScenarios.map((s) => s.metrics.initial_demand_kw.toFixed(2)),
    ].join(",");

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows, "", metricRuntime, metricP1, metricDemand].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `GridGuard_${facility?.name || "Facility"}_Scenario_Comparison.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Comparison CSV exported successfully!");
  };

  // Chart data
  const chartData = useMemo(() => {
    return activeScenarios.map((sc, index) => ({
      name: sc.name.length > 20 ? sc.name.substring(0, 18) + "..." : sc.name,
      fullName: sc.name,
      runtime_h: Number(sc.metrics.runtime_h.toFixed(2)),
      p1_coverage_pct: sc.metrics.p1_coverage_pct,
      initial_demand_kw: Number(sc.metrics.initial_demand_kw.toFixed(2)),
      isAi: sc.ai_generated,
      color: index === 0 ? "#3B82F6" : index === 1 ? "#10B981" : "#8B5CF6",
    }));
  }, [activeScenarios]);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ============================================================== */}
        {/* Header Strip & Actions */}
        {/* ============================================================== */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Scenario Comparison Matrix
              </h1>
              <Badge variant="outline" className="text-xs">
                {facility?.name || "Facility"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Side-by-side resilience analysis of operational backup strategies and circuit allocation diffs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {facilityScenarios.length < 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateSamples}
                className="gap-1.5 border-dashed border-primary text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-4 w-4" />
                Generate 3 Sample Strategies
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={activeScenarios.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>

            <Link href="/simulator">
              <Button size="sm" className="gap-1.5">
                <Clock className="h-4 w-4" />
                New Simulation
              </Button>
            </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Empty State Banner if < 2 Scenarios */}
        {/* ============================================================== */}
        {facilityScenarios.length < 2 && (
          <Card className="border-amber-500/30 bg-amber-500/5 p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                Only {facilityScenarios.length} scenario available for this facility
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                To evaluate resilience tradeoffs, you need at least 2 strategies. You can generate standard
                sample strategies right now or run custom simulations.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={handleGenerateSamples} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Generate 3 Sample Strategies (All-On / P1+P2 / P1-Only)
              </Button>
            </div>
          </Card>
        )}

        {/* ============================================================== */}
        {/* 3-Column Scenario Selector & Verdict Strip */}
        {/* ============================================================== */}
        {facilityScenarios.length >= 2 && (
          <div className="space-y-4">
            {/* Plain English Verdict Banner */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary shrink-0 mt-0.5">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Operational Verdict
                  </span>
                  <Badge variant="p1" className="text-[10px] px-1.5 py-0">
                    Decision Support
                  </Badge>
                </div>
                <p className="text-sm font-semibold text-foreground leading-relaxed">
                  {verdictText}
                </p>
              </div>
            </div>

            {/* 3-Column Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[0, 1, 2].map((colIndex) => {
                const currentId = selectedIds[colIndex] || "";
                const currentScenario = facilityScenarios.find((s) => s.id === currentId);

                return (
                  <Card
                    key={colIndex}
                    className={`border transition-all ${
                      currentScenario ? "bg-card/70 backdrop-blur-md" : "border-dashed bg-muted/20"
                    }`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">
                          Scenario Column {colIndex + 1}
                        </span>
                        {currentScenario?.ai_generated && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-purple-400 border-purple-500/30">
                            <Sparkles className="h-2.5 w-2.5" /> AI Recommended
                          </Badge>
                        )}
                      </div>

                      {/* Dropdown to pick from saved scenarios */}
                      <div className="pt-2">
                        <select
                          value={currentId}
                          onChange={(e) => {
                            const newSelected = [...selectedIds];
                            newSelected[colIndex] = e.target.value;
                            setSelectedIds(newSelected);
                          }}
                          className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="" disabled>
                            -- Select a Scenario --
                          </option>
                          {facilityScenarios.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.name} ({formatHours(sc.metrics.runtime_h)})
                            </option>
                          ))}
                        </select>
                      </div>
                    </CardHeader>

                    {currentScenario && (
                      <CardContent className="p-4 pt-2 space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t">
                          <div className="p-2 rounded-lg bg-muted/40 relative">
                            {winners?.runtimeId === currentScenario.id && (
                              <div
                                title="Winner: Longest Runtime"
                                className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md"
                              >
                                <Trophy className="h-3 w-3" />
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground block">Runtime</span>
                            <span className="font-mono font-bold text-xs text-foreground">
                              {formatHours(currentScenario.metrics.runtime_h)}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-muted/40 relative">
                            {winners?.p1Id === currentScenario.id && (
                              <div
                                title="Winner: Best P1 Coverage"
                                className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md"
                              >
                                <Trophy className="h-3 w-3" />
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground block">P1 Covered</span>
                            <span
                              className={`font-mono font-bold text-xs ${
                                currentScenario.metrics.p1_coverage_pct === 100
                                  ? "text-emerald-500"
                                  : "text-amber-500"
                              }`}
                            >
                              {currentScenario.metrics.p1_coverage_pct}%
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-muted/40 relative">
                            {winners?.loadId === currentScenario.id && (
                              <div
                                title="Winner: Lowest Load"
                                className="absolute -top-2 -right-1 bg-amber-500 text-slate-950 rounded-full p-0.5 shadow-md"
                              >
                                <Trophy className="h-3 w-3" />
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground block">Demand</span>
                            <span className="font-mono font-bold text-xs text-foreground">
                              {currentScenario.metrics.initial_demand_kw} kW
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                          <span>
                            Circuits Active:{" "}
                            <span className="font-semibold text-foreground">
                              {Object.values(currentScenario.allocation).filter(Boolean).length} /{" "}
                              {facilityEquipment.length}
                            </span>
                          </span>
                          <span>
                            Shed:{" "}
                            <span className="font-semibold text-destructive">
                              {Object.values(currentScenario.allocation).filter((v) => !v).length}
                            </span>
                          </span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* Metric Comparison Charts */}
        {/* ============================================================== */}
        {activeScenarios.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Chart 1: Estimated Runtime (Hours) */}
            <Card className="p-4 bg-card/70 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-xs text-foreground">Simulated Runtime</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Hours
                </Badge>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis fontSize={10} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [`${val} hours`, "Runtime"]}
                      labelFormatter={(label) => `Strategy: ${label}`}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="runtime_h" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.fullName === winners?.longestRuntime.name ? "#10B981" : "#3B82F6"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">
                Green bar indicates longest operational runtime
              </p>
            </Card>

            {/* Chart 2: P1 Coverage % */}
            <Card className="p-4 bg-card/70 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <h3 className="font-bold text-xs text-foreground">P1 Life-Safety Coverage</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Percentage %
                </Badge>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis domain={[0, 100]} fontSize={10} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [`${val}%`, "P1 Covered"]}
                      labelFormatter={(label) => `Strategy: ${label}`}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="p1_coverage_pct" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-p1-${index}`}
                          fill={entry.p1_coverage_pct === 100 ? "#10B981" : "#F59E0B"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">
                100% means zero critical medical/life-safety equipment dropped
              </p>
            </Card>

            {/* Chart 3: Initial Connected Demand kW */}
            <Card className="p-4 bg-card/70 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <h3 className="font-bold text-xs text-foreground">Total Active Demand</h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  Kilowatts (kW)
                </Badge>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      tickLine={false}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis fontSize={10} tickLine={false} />
                    <Tooltip
                      formatter={(val: number) => [`${val} kW`, "Initial Demand"]}
                      labelFormatter={(label) => `Strategy: ${label}`}
                      contentStyle={{
                        backgroundColor: "#0F172A",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="initial_demand_kw" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-center text-muted-foreground mt-1">
                Lower power draw directly translates to prolonged battery reserves
              </p>
            </Card>
          </div>
        )}

        {/* ============================================================== */}
        {/* Equipment ON / OFF Diff Table per Scenario */}
        {/* ============================================================== */}
        {activeScenarios.length > 0 && (
          <Card className="bg-card/70 backdrop-blur-md overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">
                    Circuit Allocation Diff Matrix
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Granular equipment on/off status compared across the {activeScenarios.length} selected strategies.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    <span className="text-muted-foreground">Active (ON)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                    <span className="text-muted-foreground">Shed (OFF)</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[300px]">Equipment / Circuit</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Draw (W)</TableHead>
                    {activeScenarios.map((sc) => (
                      <TableHead key={sc.id} className="text-center min-w-[140px]">
                        <div className="font-bold text-xs truncate max-w-[160px] mx-auto" title={sc.name}>
                          {sc.name}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {formatHours(sc.metrics.runtime_h)}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-center w-[100px]">Diff State</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {facilityEquipment.map((eq) => {
                    // Check if all activeScenarios have identical state for this eq
                    const states = activeScenarios.map((sc) => sc.allocation[eq.id] !== false);
                    const allOn = states.every((s) => s === true);
                    const allOff = states.every((s) => s === false);
                    const hasDiff = !allOn && !allOff;

                    return (
                      <TableRow key={eq.id} className={hasDiff ? "bg-amber-500/5 hover:bg-amber-500/10" : ""}>
                        <TableCell>
                          <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            {eq.name}
                            {eq.always_on && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-500/40 text-rose-400">
                                Lock
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {eq.category}
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={eq.priority === "P1" ? "p1" : eq.priority === "P2" ? "p2" : "p3"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {eq.priority}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs">
                          {formatPower(eq.power_w)}
                        </TableCell>

                        {/* Status in each selected scenario */}
                        {activeScenarios.map((sc) => {
                          const isOn = sc.allocation[eq.id] !== false;
                          return (
                            <TableCell key={sc.id} className="text-center">
                              {isOn ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 className="h-3 w-3" /> ON
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  <XCircle className="h-3 w-3" /> SHED
                                </span>
                              )}
                            </TableCell>
                          );
                        })}

                        {/* Diff Column */}
                        <TableCell className="text-center">
                          {hasDiff ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                              Differs
                            </Badge>
                          ) : allOn ? (
                            <span className="text-[10px] text-muted-foreground">All Keep</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">All Shed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
