"use client";

import React, { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Database, RefreshCw, Key } from "lucide-react";

export default function SettingsPage() {
  const { facilities, loadSeedData, resetAll } = useFacilityStore();

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Facility Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage data stores, active database links, and simulation parameters.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Simulated Data Store</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Manage the local and cloud state for facility and equipment models.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3 text-xs">
              <div>
                <span className="font-semibold block text-foreground">Reload Standard Sample Facilities</span>
                <span className="text-muted-foreground">
                  Resets and loads City Hospital Wing, College Campus, Office, and Restaurant.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadSeedData();
                  toast.success("Standard sample data reloaded!");
                }}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload Samples
              </Button>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <div>
                <span className="font-semibold block text-destructive">Reset All Local Storage</span>
                <span className="text-muted-foreground">
                  Clears all facility profiles and equipment from browser cache.
                </span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  resetAll();
                  toast.info("Store reset. Click reload samples to repopulate.");
                }}
              >
                Clear Storage
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Supabase Database Integration</CardTitle>
            </div>
            <CardDescription className="text-xs">
              PostgreSQL schema status and cloud sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-2 text-muted-foreground">
            <p>
              Schema file is generated at <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">supabase/schema.sql</code>.
            </p>
            <p>
              Environment keys are configured via <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">.env.local</code>.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
