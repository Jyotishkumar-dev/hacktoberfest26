"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, BrainCircuit } from "lucide-react";

export default function PlannerPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              AI Outage Planner
            </h1>
            <Badge variant="p2" className="text-xs">Claude 3.5 Sonnet</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Server-side Anthropic recommendations for optimal load-shed schedules and facility triage.
          </p>
        </div>

        <Card className="p-8 text-center bg-card/60 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 mb-4">
            <BrainCircuit className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-bold text-foreground">AI Decision Engine Connected</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            Phase 4 will activate full conversational prompt tuning and automated schedule dispatch.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
