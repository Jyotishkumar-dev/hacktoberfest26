"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export default function SimulatorPage() {
  const { getSelectedFacility } = useFacilityStore();
  const facility = getSelectedFacility();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Outage Simulator
            </h1>
            <Badge variant="outline" className="text-xs">{facility?.name}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate multi-hour outage timelines, peak surge factors, and battery discharge curves.
          </p>
        </div>

        <Card className="p-8 text-center bg-card/60 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            <Activity className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Advanced Outage Timeline Ready</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Simulated engine is active with 30-minute interval step evaluations. View instant results on the Dashboard or configure loads in Equipment Manager.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
