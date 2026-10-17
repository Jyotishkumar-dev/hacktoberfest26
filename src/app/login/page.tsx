"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Sparkles, LogIn, ArrowRight, AlertCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useFacilityStore } from "@/store/useFacilityStore";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const { loadSeedData } = useFacilityStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

      if (isMock) {
        // Fast local authentication fallback
        document.cookie = "gridguard_demo_auth=true; path=/; max-age=86400;";
        loadSeedData("demo-user");
        toast.success("Welcome to GridGuard AI!", {
          description: "Logged in via demo session.",
        });
        router.push("/dashboard");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        toast.error("Sign in failed", { description: error.message });
      } else if (data.user) {
        toast.success("Welcome back!", {
          description: `Logged in as ${data.user.email}`,
        });
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("Network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoHospital = async () => {
    setDemoLoading(true);
    setErrorMessage(null);

    try {
      const demoEmail = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@gridguard.ai";
      const demoPass = process.env.DEMO_PASSWORD || "DemoHospital2026!";

      const supabase = createClient();
      const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

      if (!isMock) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPass,
        });

        if (signInError) {
          // If demo account doesn't exist yet on remote, try signing up
          await supabase.auth.signUp({
            email: demoEmail,
            password: demoPass,
          });
          await supabase.auth.signInWithPassword({
            email: demoEmail,
            password: demoPass,
          });
        }
      }

      // Set cookie so middleware allows entry immediately
      document.cookie = "gridguard_demo_auth=true; path=/; max-age=86400;";
      loadSeedData("demo-judge");

      toast.success("Entering City Hospital Wing demo!", {
        description: "Pre-configured with 50 kWh battery & 9 medical equipment items.",
      });

      router.push("/dashboard");
    } catch {
      document.cookie = "gridguard_demo_auth=true; path=/; max-age=86400;";
      loadSeedData("demo-judge");
      router.push("/dashboard");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background via-card/50 to-background">
      {/* Non-negotiable UX Rule */}
      <div className="mb-6">
        <Badge variant="simulated" className="text-xs px-3 py-1">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
          SIMULATED DATA ONLY
        </Badge>
      </div>

      <Card className="w-full max-w-md border-border/80 shadow-2xl backdrop-blur-md bg-card/90">
        <CardHeader className="text-center space-y-2 pb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">GridGuard AI</CardTitle>
            <CardDescription className="text-sm mt-1">
              Outage decision-support system for facility managers
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Prominent Demo Hospital Access for Judges */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2 text-primary font-semibold text-sm">
              <Building2 className="h-4 w-4" />
              <span>Judge / Evaluator Access</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Instant one-click access with pre-configured hospital ICU simulation.
            </p>
            <Button
              type="button"
              onClick={handleDemoHospital}
              disabled={demoLoading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2 h-11"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>{demoLoading ? "Entering Hospital..." : "Try demo hospital (One-Click)"}</span>
              <ArrowRight className="h-4 w-4 ml-auto" />
            </Button>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-muted"></div>
            <span className="flex-shrink mx-4 text-xs uppercase tracking-wider text-muted-foreground">
              or sign in with email
            </span>
            <div className="flex-grow border-t border-muted"></div>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email</label>
              <Input
                type="email"
                placeholder="manager@hospital.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              variant="outline"
              className="w-full h-10 font-medium"
            >
              <LogIn className="h-4 w-4 mr-2" />
              {loading ? "Authenticating..." : "Sign In with Credentials"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t py-4 text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="ml-1 font-semibold text-primary hover:underline">
            Create account
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
