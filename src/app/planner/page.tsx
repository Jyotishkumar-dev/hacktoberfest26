"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { PlanResult, PlanAllocationItem, generateDeterministicPlan } from "@/lib/engine/planner";
import { estimateRuntime } from "@/lib/engine";
import { formatPower, formatHours } from "@/lib/utils";
import { saveScenarioAction } from "@/app/actions/scenario";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Bookmark,
  Activity,
  HeartPulse,
  Server,
  Wind,
  Lightbulb,
  Shield,
  HelpCircle,
  History,
} from "lucide-react";
import { toast } from "sonner";

function getCategoryIcon(cat: string) {
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

const EXAMPLE_PROMPTS = [
  "Preserve ICU and cold storage for at least 6 hours",
  "Extreme weather: shed all comfort heating/cooling immediately",
  "Keep IT core switches up until orderly cloud backup at hour 2",
];

interface HistoryItem {
  id: string;
  timestamp: string;
  outageH: number;
  runtimeH: number;
  plan: PlanResult;
}

export default function AIPlannerPage() {
  const router = useRouter();
  const {
    selectedFacilityId,
    equipment,
    getSelectedFacility,
    setEquipment,
  } = useFacilityStore();

  const facility = getSelectedFacility();

  const facilityItems = useMemo(() => {
    return equipment.filter((e) => !selectedFacilityId || e.facility_id === selectedFacilityId);
  }, [equipment, selectedFacilityId]);

  // Form State
  const [targetDurationH, setTargetDurationH] = useState<number>(5.0);
  const [userNotes, setUserNotes] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>("");

  // Result & Interactive Customization State
  const [activePlan, setActivePlan] = useState<PlanResult | null>(null);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const [showExplanation, setShowExplanation] = useState<boolean>(true);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // -------------------------------------------------------------
  // Live Recomputed Metrics as User Toggles Accept/Reject
  // -------------------------------------------------------------
  const livePlanState = useMemo(() => {
    if (!activePlan) return null;

    const modifiedAllocation: PlanAllocationItem[] = activePlan.allocation.map((item) => ({
      ...item,
      on: userOverrides[item.id] !== undefined ? userOverrides[item.id] : item.on,
    }));

    const activeWatts = modifiedAllocation
      .filter((a) => a.on)
      .reduce((sum, a) => sum + a.power_w, 0);

    const recomputedEst = estimateRuntime({
      capacityKwh: facility?.backup_kwh || 50,
      loadW: activeWatts,
      dodPct: facility?.dod_limit_pct || 80,
      efficiencyPct: facility?.efficiency_pct || 92,
    });

    const p1Items = modifiedAllocation.filter((a) => a.priority === "P1");
    const p1Active = p1Items.filter((a) => a.on).length;
    const p2Items = modifiedAllocation.filter((a) => a.priority === "P2");
    const p2Active = p2Items.filter((a) => a.on).length;

    const coverageP1 = p1Items.length > 0 ? Math.round((p1Active / p1Items.length) * 100) : 100;
    const coverageP2 = p2Items.length > 0 ? Math.round((p2Active / p2Items.length) * 100) : 100;

    return {
      allocation: modifiedAllocation,
      estimated_runtime_h: recomputedEst.runtimeH,
      coverage_p1_pct: coverageP1,
      coverage_p2_pct: coverageP2,
      activeWatts,
    };
  }, [activePlan, userOverrides, facility]);

  // -------------------------------------------------------------
  // Plan Generation Handlers
  // -------------------------------------------------------------
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setProgressStep(`Analyzing ${facilityItems.length} facility equipment items...`);

    const timer1 = setTimeout(() => {
      setProgressStep("Evaluating P1 critical reserves & DoD discharge limits...");
    }, 600);
    const timer2 = setTimeout(() => {
      setProgressStep("Consulting Claude 3.5 Sonnet energy advisor model...");
    }, 1200);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipment: facilityItems,
          facility_id: facility?.id,
          backup_kwh: facility?.backup_kwh || 50,
          dod_limit_pct: facility?.dod_limit_pct || 80,
          efficiency_pct: facility?.efficiency_pct || 92,
          outage_duration_h: targetDurationH,
          user_notes: userNotes,
        }),
      });

      if (!response.ok) {
        throw new Error(`Planner returned HTTP ${response.status}`);
      }

      const plan: PlanResult = await response.json();
      setActivePlan(plan);
      setUserOverrides({});

      // Push to history
      setHistoryList((prev) => [
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          outageH: targetDurationH,
          runtimeH: plan.estimated_runtime_h,
          plan,
        },
        ...prev.slice(0, 4),
      ]);

      if (plan.is_fallback) {
        toast.info("Rule-Based Plan Generated", {
          description: `Energy budget optimized for ${targetDurationH} hours.`,
        });
      } else {
        toast.success("AI Resilience Plan Ready!", {
          description: `Optimized by Claude Sonnet for ${targetDurationH}h outage.`,
        });
      }
    } catch {
      handleExecuteDeterministicFallback();
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsGenerating(false);
      setProgressStep("");
    }
  };

  const handleExecuteDeterministicFallback = () => {
    const plan = generateDeterministicPlan({
      equipment: facilityItems,
      capacityKwh: facility?.backup_kwh || 50,
      dodPct: facility?.dod_limit_pct || 80,
      efficiencyPct: facility?.efficiency_pct || 92,
      outageDurationH: targetDurationH,
      userNotes,
    });

    setActivePlan(plan);
    setUserOverrides({});
    toast.success("Deterministic Recovery Plan Generated", {
      description: "Shedding P3 non-essential circuits to protect endurance.",
    });
  };

  const handleToggleItemDecision = (id: string, currentOn: boolean) => {
    setUserOverrides((prev) => ({
      ...prev,
      [id]: !currentOn,
    }));
  };

  // -------------------------------------------------------------
  // Apply Plan to Simulator / Save Scenario
  // -------------------------------------------------------------
  const handleApplyToSimulator = () => {
    if (!livePlanState) return;

    const allocationMap = new Map(livePlanState.allocation.map((a) => [a.id, a.on]));
    setEquipment(
      equipment.map((e) => {
        if (allocationMap.has(e.id)) {
          return { ...e, is_active: allocationMap.get(e.id) };
        }
        return e;
      })
    );

    toast.success("AI Allocation applied to simulator!", {
      description: "Navigating to Scenario Simulator...",
    });
    router.push("/simulator");
  };

  const handleSaveAsScenario = async () => {
    if (!livePlanState || !activePlan) return;

    const allocationRecord: Record<string, boolean> = {};
    livePlanState.allocation.forEach((a) => {
      allocationRecord[a.id] = a.on;
    });

    const res = await saveScenarioAction({
      facility_id: facility?.id || "fac-hospital-01",
      name: `${targetDurationH}h AI Recovery Plan (${facility?.name})`,
      outage_duration_h: targetDurationH,
      allocation: allocationRecord,
      ai_generated: true,
      metrics: {
        runtime_h: livePlanState.estimated_runtime_h,
        initial_demand_kw: Number((livePlanState.activeWatts / 1000).toFixed(2)),
        unmet_load_pct: livePlanState.estimated_runtime_h < targetDurationH ? 20 : 0,
        p1_coverage_pct: livePlanState.coverage_p1_pct,
      },
    });

    if (res.success) {
      toast.success("AI Plan Saved as Scenario!", {
        description: "View and replay in Simulator at any time.",
      });
    } else {
      toast.error("Could not save scenario", { description: res.error });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                AI Outage Recovery Planner
              </h1>
              <Badge variant="p2" className="text-xs">
                Claude 3.5 Sonnet
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Intelligent load triage prioritizing life safety (P1) and energy endurance for{" "}
              <span className="font-semibold text-foreground">{facility?.name || "Facility"}</span>.
            </p>
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ============================================================ */}
          {/* LEFT: Prompt Input & Controls (4 cols) */}
          {/* ============================================================ */}
          <Card className="lg:col-span-4 p-5 bg-card/70 backdrop-blur-md space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">Outage Strategy Request</h3>
            </div>

            {/* Target Duration Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">Target Outage Duration</label>
                <span className="font-mono font-bold text-primary">{targetDurationH} hours</span>
              </div>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="72"
                value={targetDurationH}
                onChange={(e) => setTargetDurationH(parseFloat(e.target.value) || 1)}
                className="font-mono text-sm"
              />
            </div>

            {/* Operational Requirements Free-text */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Operational Constraints & Notes
              </label>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. ICU wing must maintain 100% power; prioritize server room cooling if temperature rises."
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {/* Example Prompt Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Quick Example Directives
              </span>
              <div className="flex flex-col gap-1.5">
                {EXAMPLE_PROMPTS.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setUserNotes(promptText)}
                    className="text-left rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 p-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    💡 {promptText}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Plan Button */}
            <div className="pt-2 space-y-2">
              <Button
                onClick={handleGeneratePlan}
                disabled={isGenerating}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>{isGenerating ? "Analyzing..." : "Generate AI Recovery Plan"}</span>
              </Button>

              {/* Loading State Progress */}
              {isGenerating && (
                <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-2 border animate-pulse">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Activity className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-[11px]">{progressStep}</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse w-3/4" />
                  </div>
                </div>
              )}

              {/* Direct Deterministic Fallback Option */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExecuteDeterministicFallback}
                className="w-full text-xs text-muted-foreground hover:text-foreground border-dashed"
              >
                Use rule-based fallback (Instant offline)
              </Button>
            </div>

            {/* Recent History List */}
            {historyList.length > 0 && (
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  <span>Recommendation History</span>
                </div>
                <div className="space-y-1.5">
                  {historyList.map((hist) => (
                    <div
                      key={hist.id}
                      onClick={() => {
                        setActivePlan(hist.plan);
                        setUserOverrides({});
                      }}
                      className="flex items-center justify-between p-2 rounded-lg border bg-muted/20 hover:bg-muted/50 cursor-pointer text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {hist.outageH}h Target ({hist.timestamp})
                      </span>
                      <span className="font-mono text-emerald-500 font-bold">
                        {formatHours(hist.runtimeH)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ============================================================ */}
          {/* RIGHT: AI Recommendation Result & Line-by-Line Toggles (8 cols) */}
          {/* ============================================================ */}
          <div className="lg:col-span-8 space-y-5">
            {!activePlan ? (
              <Card className="p-12 text-center border-dashed bg-card/50">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
                  <BrainCircuit className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-foreground">No Plan Generated Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-5">
                  Set a target outage duration and click &quot;Generate AI Recovery Plan&quot; to receive a customized, line-by-line load allocation from Claude.
                </p>
                <Button onClick={handleGeneratePlan} className="font-semibold gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Generate Initial Plan
                </Button>
              </Card>
            ) : (
              <>
                {/* Result Hero Card */}
                <Card className="p-5 bg-card/80 backdrop-blur-md shadow-sm border-primary/30">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-500/15 text-emerald-500 font-bold px-2.5 py-0.5 text-xs">
                          {activePlan.is_fallback ? "Rule-Based Plan" : "Claude 3.5 Recommendation"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          Target: {targetDurationH} hours
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground mt-1">
                        Recommended Load Allocation
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyToSimulator}
                        className="text-xs gap-1.5"
                      >
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        Apply to Simulator
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveAsScenario}
                        className="text-xs font-semibold gap-1.5 bg-primary text-primary-foreground shadow-sm"
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                        Save Scenario
                      </Button>
                    </div>
                  </div>

                  {/* Metrics Ring Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                    {/* Estimated Runtime */}
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Estimated Runtime
                      </span>
                      <p className="text-2xl font-extrabold font-mono text-primary mt-1">
                        {formatHours(livePlanState?.estimated_runtime_h || activePlan.estimated_runtime_h)}
                      </p>
                      <span className="text-[10px] text-emerald-500 font-semibold">
                        +{activePlan.runtime_improvement_h}h vs everything on
                      </span>
                    </div>

                    {/* Active Load */}
                    <div className="rounded-xl border bg-muted/30 p-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Active Demand
                      </span>
                      <p className="text-2xl font-extrabold font-mono text-foreground mt-1">
                        {formatPower(livePlanState?.activeWatts || 0)}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {livePlanState?.allocation.filter((a) => a.on).length} circuits powered
                      </span>
                    </div>

                    {/* P1 Coverage Ring */}
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <span className="text-[10px] uppercase font-bold text-[#EF4444]">
                        P1 Critical Coverage
                      </span>
                      <p className="text-2xl font-extrabold font-mono text-[#EF4444] mt-1">
                        {livePlanState?.coverage_p1_pct}%
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        Life safety & telemetry
                      </span>
                    </div>

                    {/* P2 Coverage Ring */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <span className="text-[10px] uppercase font-bold text-[#F59E0B]">
                        P2 Important Coverage
                      </span>
                      <p className="text-2xl font-extrabold font-mono text-[#F59E0B] mt-1">
                        {livePlanState?.coverage_p2_pct}%
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        HVAC & cold storage
                      </span>
                    </div>
                  </div>

                  {/* Expandable Natural Language Explanation */}
                  <div className="mt-4 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowExplanation(!showExplanation)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        Advisor Strategy Explanation
                      </span>
                      {showExplanation ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {showExplanation && (
                      <div className="mt-2.5 p-3 rounded-xl bg-muted/40 border text-xs text-muted-foreground leading-relaxed">
                        <p>{activePlan.explanation}</p>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Line-by-Line Equipment Decisions */}
                <Card className="p-5 bg-card/70 backdrop-blur-md space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div>
                      <h4 className="font-bold text-sm text-foreground">
                        Line-by-Line Circuit Allocation
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Accept or override individual circuits. Metrics recalculate instantly.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {livePlanState?.allocation.length} Circuits
                    </Badge>
                  </div>

                  <div className="divide-y divide-border">
                    {livePlanState?.allocation.map((item) => {
                      const isOn = item.on;
                      const priorityColor =
                        item.priority === "P1"
                          ? "text-[#EF4444]"
                          : item.priority === "P2"
                          ? "text-[#F59E0B]"
                          : "text-[#22C55E]";

                      return (
                        <div
                          key={item.id}
                          className={`flex items-center justify-between py-3 px-2 rounded-lg transition-colors ${
                            !isOn ? "bg-muted/20 opacity-60" : "hover:bg-muted/10"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 p-1 rounded bg-muted">
                              {getCategoryIcon(item.name.includes("ICU") ? "Medical" : item.priority === "P1" ? "IT" : "HVAC")}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  {item.name}
                                </span>
                                <span className={`text-[10px] font-bold ${priorityColor}`}>
                                  {item.priority}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] py-0 px-1 font-mono ${
                                    isOn ? "border-emerald-500/40 text-emerald-500" : "border-slate-500/40 text-muted-foreground"
                                  }`}
                                >
                                  {isOn ? "POWERED" : "SHED"}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {item.reason}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 pl-4 shrink-0">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {formatPower(item.power_w)}
                            </span>
                            <Switch
                              checked={isOn}
                              onCheckedChange={() => handleToggleItemDecision(item.id, isOn)}
                              aria-label={`Toggle ${item.name}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
