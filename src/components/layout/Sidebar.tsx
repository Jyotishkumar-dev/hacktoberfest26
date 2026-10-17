"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  Activity,
  Sparkles,
  GitCompare,
  Settings,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Equipment",
    href: "/equipment",
    icon: Server,
  },
  {
    label: "Simulator",
    href: "/simulator",
    icon: Activity,
  },
  {
    label: "AI Planner",
    href: "/planner",
    icon: Sparkles,
    badge: "AI",
  },
  {
    label: "Compare",
    href: "/compare",
    icon: GitCompare,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 flex-col border-r bg-card/60 backdrop-blur-md">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-base">GridGuard</span>
            <span className="rounded bg-primary/10 px-1 py-0.2 text-[10px] font-bold text-primary">AI</span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Facility Power Decision
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3">
        <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
          Core Operations
        </div>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-transform group-hover:scale-110",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Quick Power Formula Note */}
      <div className="border-t p-4 m-3 rounded-xl bg-muted/40 border-dashed">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Core Equation</span>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          Runtime = (Cap × DoD × Eff) / Load
        </p>
      </div>
    </aside>
  );
}
