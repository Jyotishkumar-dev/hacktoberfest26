"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { estimateRuntime } from "@/lib/engine";
import { formatHours, formatPower } from "@/lib/utils";
import { GitCompare } from "lucide-react";

export default function ComparePage() {
  const { facilities, equipment } = useFacilityStore();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Facility Comparison
            </h1>
            <Badge variant="outline" className="text-xs">{facilities.length} Facilities</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Compare backup capacities, total loads, and simulated runtimes across campuses and facilities.
          </p>
        </div>

        <Card className="bg-card/70 backdrop-blur-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Facility Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Backup Capacity</TableHead>
                <TableHead className="text-right">Connected Load</TableHead>
                <TableHead className="text-right">DoD / Eff</TableHead>
                <TableHead className="text-right font-bold text-primary">Simulated Runtime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.map((fac) => {
                const facItems = equipment.filter((e) => e.facility_id === fac.id);
                const loadW = facItems.reduce((acc, curr) => acc + (curr.power_w || 0), 0);
                const est = estimateRuntime({
                  capacityKwh: fac.backup_kwh,
                  loadW,
                  dodPct: fac.dod_limit_pct,
                  efficiencyPct: fac.efficiency_pct,
                });

                return (
                  <TableRow key={fac.id}>
                    <TableCell className="font-bold text-sm">{fac.name}</TableCell>
                    <TableCell className="capitalize text-xs text-muted-foreground">
                      {fac.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {fac.backup_kwh} kWh ({fac.backup_type})
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatPower(loadW)} ({facItems.length} items)
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {fac.dod_limit_pct}% / {fac.efficiency_pct}%
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold text-emerald-500">
                      {formatHours(est.runtimeH)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
