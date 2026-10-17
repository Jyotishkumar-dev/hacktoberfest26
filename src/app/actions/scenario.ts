"use server";

import { createClient } from "@/lib/supabase/server";

export interface SaveScenarioPayload {
  facility_id: string;
  name: string;
  outage_duration_h: number;
  allocation: Record<string, boolean>;
  ai_generated?: boolean;
  metrics: {
    runtime_h: number;
    initial_demand_kw: number;
    unmet_load_pct: number;
    p1_coverage_pct: number;
  };
}

export async function saveScenarioAction(payload: SaveScenarioPayload) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isMock =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

    if (!isMock && user) {
      const { data, error } = await supabase
        .from("scenarios")
        .insert({
          user_id: user.id,
          facility_id: payload.facility_id,
          name: payload.name,
          outage_duration_h: payload.outage_duration_h,
          allocation: payload.allocation,
          ai_generated: payload.ai_generated ?? false,
          metrics: payload.metrics,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase scenario save error:", error);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    }

    // Local Mock Mode success
    return {
      success: true,
      data: {
        id: `scen-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to save scenario";
    return { success: false, error: errorMsg };
  }
}
