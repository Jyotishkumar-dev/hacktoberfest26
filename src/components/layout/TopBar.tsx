"use client";

import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Sparkles, User, LogOut, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { loadSampleDataAction } from "@/app/actions/seed";
import { createClient } from "@/lib/supabase/client";

export function TopBar() {
  const router = useRouter();
  const {
    facilities,
    selectedFacilityId,
    setSelectedFacilityId,
    setFacilities,
    setEquipment,
    loadSeedData,
  } = useFacilityStore();
  const [isSeeding, setIsSeeding] = useState(false);

  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId);

  const handleFacilityChange = (id: string) => {
    setSelectedFacilityId(id);
    const target = facilities.find((f) => f.id === id);
    if (target) {
      toast.success(`Active facility switched to ${target.name}`, {
        description: `${target.backup_kwh} kWh ${target.backup_type} (${target.dod_limit_pct}% DoD, ${target.efficiency_pct}% eff)`,
      });
    }
  };

  const handleLoadSampleData = async () => {
    setIsSeeding(true);
    try {
      const res = await loadSampleDataAction();
      if (res.data) {
        setFacilities(res.data.facilities);
        setEquipment(res.data.equipment);
        setSelectedFacilityId(res.data.facilities[0].id);
        toast.success("Sample data loaded successfully!", {
          description: "4 facility profiles & 34 equipment items ready for simulation.",
        });
      }
    } catch {
      loadSeedData();
      toast.success("Sample data loaded locally!", {
        description: "4 facility profiles & 34 equipment items loaded into store.",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      document.cookie = "gridguard_demo_auth=; Max-Age=0; path=/;";
      toast.info("Signed out successfully");
      router.push("/login");
    } catch {
      document.cookie = "gridguard_demo_auth=; Max-Age=0; path=/;";
      router.push("/login");
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6 shadow-sm">
      {/* Left: Facility Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:inline-block">
            Facility
          </span>
        </div>

        {facilities.length > 0 ? (
          <Select
            value={selectedFacilityId || facilities[0]?.id}
            onValueChange={handleFacilityChange}
          >
            <SelectTrigger
              className="w-[200px] sm:w-[260px] font-medium text-sm border-primary/20 hover:border-primary/50 transition-colors"
              aria-label="Select active facility"
            >
              <SelectValue placeholder="Select Facility">
                <span className="font-semibold">{selectedFacility?.name || "Choose Facility"}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {facilities.map((fac) => (
                <SelectItem key={fac.id} value={fac.id} className="cursor-pointer">
                  <div className="flex flex-col text-left py-0.5">
                    <span className="font-semibold text-sm">{fac.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {fac.backup_kwh} kWh {fac.backup_type} • {fac.type.replace("_", " ")}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSampleData}
            disabled={isSeeding}
            className="text-xs gap-1.5"
          >
            <Database className="h-3.5 w-3.5 text-primary" />
            No facilities - Load sample data
          </Button>
        )}
      </div>

      {/* Center / Right: Persistent SIMULATED DATA badge & quick actions */}
      <div className="flex items-center gap-3">
        {/* NON-NEGOTIABLE RULE: Persistent gray "SIMULATED DATA" badge on every screen */}
        <Badge
          variant="simulated"
          className="border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 text-[11px] font-mono tracking-wider font-semibold shadow-xs select-none"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
          SIMULATED DATA
        </Badge>

        {/* Quick Seed Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLoadSampleData}
          disabled={isSeeding}
          className="hidden sm:inline-flex text-xs font-medium gap-1.5 hover:bg-primary/5 border-dashed"
          title="Seed sample data (City Hospital, College, Office, Restaurant)"
          aria-label="Load sample data"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-primary ${isSeeding ? "animate-spin" : ""}`} />
          <span>Load sample data</span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full border hover:bg-accent"
              aria-label="User account menu"
            >
              <User className="h-4 w-4 text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="text-xs font-semibold text-foreground">Facility Manager</p>
              <p className="text-[11px] text-muted-foreground truncate">demo@gridguard.ai</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLoadSampleData} className="cursor-pointer">
              <Database className="mr-2 h-4 w-4 text-primary" />
              <span>Reload Sample Data</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
