"use client";

import React, { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useFacilityStore } from "@/store/useFacilityStore";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Server, Activity, Sparkles, GitCompare, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { facilities, loadSeedData } = useFacilityStore();
  const pathname = usePathname();

  // Load sample data automatically on initial load if store is empty
  useEffect(() => {
    if (facilities.length === 0) {
      loadSeedData();
    }
  }, [facilities.length, loadSeedData]);

  const mobileNavItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Equipment", href: "/equipment", icon: Server },
    { label: "Simulator", href: "/simulator", icon: Activity },
    { label: "AI Planner", href: "/planner", icon: Sparkles },
    { label: "Compare", href: "/compare", icon: GitCompare },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile / Tablet Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-16 border-t bg-background/95 backdrop-blur md:hidden items-center justify-around px-2">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors p-1 rounded-md",
                isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
