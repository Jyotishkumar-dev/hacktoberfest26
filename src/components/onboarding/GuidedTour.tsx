"use client";

import React, { useState } from "react";
import { useFacilityStore } from "@/store/useFacilityStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

export interface TourStep {
  id: number;
  title: string;
  badge: string;
  description: string;
  targetPath: string;
  targetLabel: string;
  icon: React.ReactNode;
  tips: string[];
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    title: "1. Check Equipment Priorities",
    badge: "Step 1 of 3",
    description:
      "Triage your facility loads into P1 Critical (life-safety), P2 Important, and P3 Non-essential. P1 equipment is safety-locked to prevent accidental shedding.",
    targetPath: "/equipment",
    targetLabel: "Go to Equipment Manager",
    icon: <ShieldAlert className="h-6 w-6 text-rose-500" />,
    tips: [
      "Drag-and-drop or use accessible dropdowns to categorize circuits.",
      "Always-on safety lock items cannot be demoted to P3 non-essential.",
      "Import existing building loads with our CSV template.",
    ],
  },
  {
    id: 2,
    title: "2. Run an Outage Simulation",
    badge: "Step 2 of 3",
    description:
      "Test grid failure durations from 30 minutes up to 72 hours. Scrub the battery drain curve, monitor circuit dropouts, and toggle devices mid-run.",
    targetPath: "/simulator",
    targetLabel: "Open Scenario Simulator",
    icon: <Clock className="h-6 w-6 text-sky-500" />,
    tips: [
      "Live slider updates runtime in under 200ms without submit buttons.",
      "Interactive power-flow topology animates battery drain in real time.",
      "Save customized scenarios for side-by-side comparison.",
    ],
  },
  {
    id: 3,
    title: "3. Generate AI Recovery Plan",
    badge: "Step 3 of 3",
    description:
      "Ask Claude AI to synthesize target outage durations and recommend optimal load shedding that guarantees life-safety P1 survival while maximizing total hours.",
    targetPath: "/planner",
    targetLabel: "Try AI Recovery Planner",
    icon: <Sparkles className="h-6 w-6 text-purple-400" />,
    tips: [
      "Zero-trust validation: AI plans are re-verified by our deterministic engine.",
      "Review plain-English operational reasoning for every circuit shed.",
      "1-click apply recommended load shedding directly to the live simulator.",
    ],
  },
];

interface GuidedTourProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function GuidedTour({ forceOpen, onClose }: GuidedTourProps) {
  const { onboardingDismissed, setOnboardingDismissed } = useFacilityStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const router = useRouter();

  // If dismissed and not forced open, don't show
  if (onboardingDismissed && !forceOpen) {
    return null;
  }

  const currentStep = TOUR_STEPS[currentStepIndex];

  const handleDismiss = () => {
    setOnboardingDismissed(true);
    if (onClose) onClose();
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="First-login guided tour"
      className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-2.5rem)] rounded-2xl border border-primary/40 bg-slate-950/95 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
            {currentStep.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                {currentStep.badge}
              </Badge>
              <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                Guided Tour
              </span>
            </div>
            <h3 className="font-bold text-sm text-foreground">{currentStep.title}</h3>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="py-3 space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {currentStep.description}
        </p>

        {/* Action tips */}
        <div className="rounded-lg bg-slate-900/80 p-2.5 border border-border/40 space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-300 uppercase tracking-wide block">
            Key Highlights:
          </span>
          {currentStep.tips.map((tip, idx) => (
            <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300">
              <ChevronRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-[11px] text-muted-foreground h-8 px-2 hover:text-foreground"
        >
          Skip tour
        </Button>

        <div className="flex items-center gap-2">
          {currentStepIndex > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              className="h-8 px-2.5 text-xs gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}

          {currentStepIndex < TOUR_STEPS.length - 1 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleNext}
              className="h-8 px-2.5 text-xs"
            >
              Next Tip
            </Button>
          ) : null}

          <Button
            size="sm"
            onClick={() => handleNavigate(currentStep.targetPath)}
            className="h-8 px-3 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <span>{currentStep.targetLabel}</span>
            {currentStepIndex === TOUR_STEPS.length - 1 ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
