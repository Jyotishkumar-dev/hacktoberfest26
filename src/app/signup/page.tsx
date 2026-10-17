"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserPlus, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { useFacilityStore } from "@/store/useFacilityStore";
import { toast } from "sonner";

export default function SignupPage() {
  const router = useRouter();
  const { loadSeedData } = useFacilityStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

      if (isMock) {
        document.cookie = "gridguard_demo_auth=true; path=/; max-age=86400;";
        loadSeedData();
        toast.success("Account created successfully!");
        router.push("/dashboard");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
      } else {
        toast.success("Account created!", {
          description: data.user ? "Welcome to GridGuard AI" : "Check your email for confirmation.",
        });
        loadSeedData(data.user?.id || "new-user");
        router.push("/dashboard");
      }
    } catch {
      setErrorMessage("Unable to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background via-card/50 to-background">
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
            <CardTitle className="text-2xl font-bold tracking-tight">Create Manager Account</CardTitle>
            <CardDescription className="text-sm mt-1">
              Start modeling backup power and emergency shedding
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email</label>
              <Input
                type="email"
                placeholder="facility.lead@campus.edu"
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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Confirm Password</label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 font-semibold"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {loading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-between border-t py-4 text-xs text-muted-foreground">
          <Link href="/login" className="flex items-center text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to login
          </Link>
          <span>GridGuard AI v1.0</span>
        </CardFooter>
      </Card>
    </div>
  );
}
