"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { FacilityType, BackupType } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Database,
  RefreshCw,
  SlidersHorizontal,
  Calculator,
  ShieldAlert,
  Info,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { formatHours, formatPower } from "@/lib/utils";
import { estimateRuntime } from "@/lib/engine";

export default function SettingsPage() {
  const {
    getSelectedFacility,
    updateFacilityProfile,
    loadSeedData,
    resetAll,
    getFacilityEquipment,
    setOnboardingDismissed,
  } = useFacilityStore();

  const facility = getSelectedFacility();
  const equipment = getFacilityEquipment();

  // Local form state for facility profile editing
  const [name, setName] = useState(facility?.name || "");
  const [facType, setFacType] = useState<FacilityType>(facility?.type || "hospital");
  const [backupType, setBackupType] = useState<BackupType>(facility?.backup_type || "Battery Bank");
  const [backupKwh, setBackupKwh] = useState<number>(facility?.backup_kwh || 50);
  const [dodLimitPct, setDodLimitPct] = useState<number>(facility?.dod_limit_pct || 80);
  const [efficiencyPct, setEfficiencyPct] = useState<number>(facility?.efficiency_pct || 92);
  const [isSaved, setIsSaved] = useState(false);

  // Sync state when active facility switches
  useEffect(() => {
    if (facility) {
      setName(facility.name);
      setFacType(facility.type);
      setBackupType(facility.backup_type);
      setBackupKwh(facility.backup_kwh);
      setDodLimitPct(facility.dod_limit_pct);
      setEfficiencyPct(facility.efficiency_pct);
      setIsSaved(false);
    }
  }, [facility]);

  // Current connected load
  const totalLoadW = equipment
    .filter((e) => e.is_active !== false)
    .reduce((sum, item) => sum + (item.power_w || 0), 0);

  // Live calculation based on current edited inputs
  const liveEstimate = estimateRuntime({
    capacityKwh: backupKwh,
    loadW: totalLoadW,
    dodPct: dodLimitPct,
    efficiencyPct: efficiencyPct,
  });

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facility) return;

    if (!name.trim()) {
      toast.error("Facility name cannot be empty.");
      return;
    }

    if (backupKwh <= 0) {
      toast.error("Backup capacity must be greater than 0 kWh.");
      return;
    }

    updateFacilityProfile(facility.id, {
      name: name.trim(),
      type: facType,
      backup_type: backupType,
      backup_kwh: Number(backupKwh),
      dod_limit_pct: Number(dodLimitPct),
      efficiency_pct: Number(efficiencyPct),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
    toast.success("Facility profile updated successfully!", {
      description: `${name}: ${backupKwh} kWh ${backupType} (${dodLimitPct}% DoD, ${efficiencyPct}% eff)`,
    });
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        {/* Header */}
        <div className="border-b pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Facility & System Settings
              </h1>
              <Badge variant="outline" className="text-xs">
                {facility?.name || "Facility"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure energy storage parameters, inspect mathematical formulas, and review decision-support assumptions.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOnboardingDismissed(false);
              toast.info("Guided tour restarted!");
            }}
            className="text-xs gap-1.5 self-start sm:self-auto"
          >
            <HelpCircle className="h-4 w-4 text-primary" />
            Restart Guided Tour
          </Button>
        </div>

        {/* 1. Facility Profile Editor */}
        <Card className="bg-card/70 backdrop-blur-md">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold">Facility Energy Profile</CardTitle>
                <CardDescription className="text-xs">
                  Edit nameplate storage, chemistry tolerances, and conversion efficiency for the active site.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleSaveProfile}>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Facility Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Facility Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. City Hospital (West Wing)"
                    className="text-xs font-medium"
                    required
                  />
                </div>

                {/* Facility Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Facility Type</label>
                  <Select
                    value={facType}
                    onValueChange={(val) => setFacType(val as FacilityType)}
                  >
                    <SelectTrigger className="text-xs font-medium">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hospital">Hospital / Healthcare</SelectItem>
                      <SelectItem value="college">College / University Campus</SelectItem>
                      <SelectItem value="office">Commercial Office Building</SelectItem>
                      <SelectItem value="small_business">Small Business / Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Backup Source Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Primary Backup Source</label>
                  <Select
                    value={backupType}
                    onValueChange={(val) => setBackupType(val as BackupType)}
                  >
                    <SelectTrigger className="text-xs font-medium">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Battery Bank">Battery Bank (BESS / LiFePO4)</SelectItem>
                      <SelectItem value="UPS">Central Uninterruptible Power Supply (UPS)</SelectItem>
                      <SelectItem value="Generator">Diesel / Gas Generator (Reserve kWh)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nameplate Backup kWh */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      Nameplate Capacity (kWh)
                    </label>
                    <span className="font-mono text-xs font-bold text-primary">{backupKwh} kWh</span>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    step={1}
                    value={backupKwh}
                    onChange={(e) => setBackupKwh(Math.max(1, Number(e.target.value)))}
                    className="font-mono text-xs"
                    required
                  />
                </div>
              </div>

              {/* Sliders for DoD & Efficiency */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t">
                {/* DoD Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Depth of Discharge Limit (DoD)
                    </span>
                    <span className="font-mono font-bold text-primary">{dodLimitPct}%</span>
                  </div>
                  <Slider
                    min={20}
                    max={100}
                    step={1}
                    value={[dodLimitPct]}
                    onValueChange={(val) => setDodLimitPct(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Safe operating threshold before low-voltage cutoff. Prevents irreversible cell degradation.
                  </p>
                </div>

                {/* Efficiency */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">
                      Inverter / System Efficiency
                    </span>
                    <span className="font-mono font-bold text-primary">{efficiencyPct}%</span>
                  </div>
                  <Slider
                    min={60}
                    max={99}
                    step={1}
                    value={[efficiencyPct]}
                    onValueChange={(val) => setEfficiencyPct(val[0])}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Combined DC-to-AC conversion and wiring thermal loss factor (typically 88%–95%).
                  </p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="p-4 border-t bg-muted/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Changes apply immediately to simulator, dashboard, and AI planner.
              </span>
              <Button type="submit" size="sm" className="gap-1.5">
                {isSaved ? <CheckCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                {isSaved ? "Saved!" : "Save Facility Profile"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* 2. Formula Documentation & Live Substitution */}
        <Card className="bg-card/70 backdrop-blur-md">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold">Inline Runtime Calculation Formula</CardTitle>
                <CardDescription className="text-xs">
                  Deterministic physics formulation utilized by the GridGuard calculation engine.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="rounded-xl bg-slate-900 border p-4 font-mono text-xs text-slate-200 space-y-3">
              <div className="text-primary font-bold">
                Runtime (h) = [ Usable Energy (kWh) × 1,000 ] / Active Connected Load (W)
              </div>
              <div className="text-muted-foreground text-[11px] pl-3 border-l-2 border-primary/40 space-y-1">
                <div>Where:</div>
                <div>• Usable Energy (kWh) = Nameplate Capacity (kWh) × ( DoD% / 100 ) × ( Efficiency% / 100 )</div>
                <div>• Active Connected Load (W) = Sum of all energized equipment circuits</div>
              </div>
            </div>

            {/* Live substituted numbers box */}
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wide block">
                Live Substituted Values for {name}:
              </span>
              <div className="font-mono text-xs text-foreground space-y-1">
                <p>
                  Usable Energy = {backupKwh} kWh × ({dodLimitPct}% / 100) × ({efficiencyPct}% / 100) ={" "}
                  <span className="font-bold text-emerald-400">{liveEstimate.usableKwh.toFixed(2)} kWh</span>
                </p>
                <p>
                  Active Demand = <span className="font-bold text-amber-400">{formatPower(totalLoadW)}</span>
                </p>
                <p className="pt-1 border-t border-border/40 font-semibold text-sm">
                  Simulated Runtime = ({liveEstimate.usableKwh.toFixed(2)} × 1,000) / {totalLoadW} W ={" "}
                  <span className="text-emerald-400 font-bold">{formatHours(liveEstimate.runtimeH)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Operational Assumptions & Limitations */}
        <Card className="bg-card/70 backdrop-blur-md">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              <div>
                <CardTitle className="text-base font-bold">System Assumptions & Limitations</CardTitle>
                <CardDescription className="text-xs">
                  Important operational constraints and safety boundaries for facility engineers.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">1. Simulated Data Notice:</strong>
                All runtime metrics and depletion graphs are generated algorithmic estimates designed for
                facility readiness drills, capacity planning, and tabletop simulations. Real battery cell
                discharge rates fluctuate based on temperature, age, internal resistance, and Peukert factor.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border">
              <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">2. Constant Draw (Steady-State) Approximation:</strong>
                Connected electrical appliances are modeled with continuous power draw in Watts. Dynamic motor
                inrush currents, HVAC compressor startup spikes, and intermittent duty cycles are linearly
                approximated to ensure dependable baseline estimations.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border">
              <SlidersHorizontal className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">3. Single Primary Source Architecture:</strong>
                The simulation calculates runtime assuming a unified primary backup storage reserve or microgrid
                inverter bus. Multi-generator synchronization and complex transfer switch transitions are
                abstracted to the circuit distribution panels.
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground block">4. Decision Support System Only:</strong>
                GridGuard AI serves strictly as an operational decision-support tool. It does not control physical
                switchgear or circuit breakers directly. All load shedding decisions must be confirmed and executed
                by certified facility management personnel in accordance with NFPA 110 and local electrical codes.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Reset & Seed Controls */}
        <Card>
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-bold">Data Store Management</CardTitle>
                <CardDescription className="text-xs">
                  Reload pre-built sample facilities or purge local storage cache.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4 text-xs">
              <div>
                <span className="font-semibold block text-foreground">Reload Standard Sample Facilities</span>
                <span className="text-muted-foreground">
                  Resets and populates City Hospital Wing, College Campus, Office, and Restaurant with 3 pre-saved comparison scenarios.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadSeedData();
                  toast.success("Standard sample data reloaded!");
                }}
                className="gap-1.5 shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Samples
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold block text-destructive">Reset All Local Storage</span>
                <span className="text-muted-foreground">
                  Clears all facility profiles, custom equipment, and saved scenarios from browser cache.
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  resetAll();
                  toast.info("Store reset. Click reload samples to repopulate.");
                }}
                className="shrink-0"
              >
                Clear Storage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
