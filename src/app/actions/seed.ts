"use server";

import { createClient } from "@/lib/supabase/server";
import { generateSampleData } from "@/lib/seed/sampleData";

export async function loadSampleDataAction() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userId = user?.id || "demo-user";
    const sample = generateSampleData(userId);

    const isMock =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

    if (!isMock && user) {
      // 1. Clean previous sample facilities for user if any
      await supabase.from("facility_profiles").delete().eq("user_id", user.id);

      // 2. Insert the 4 facility profiles
      const { error: facError } = await supabase
        .from("facility_profiles")
        .insert(sample.facilities);

      if (facError) {
        console.error("Error inserting facilities:", facError);
        return {
          success: false,
          error: facError.message,
          data: sample,
        };
      }

      // 3. Insert equipment
      const { error: eqError } = await supabase
        .from("equipment")
        .insert(sample.equipment);

      if (eqError) {
        console.error("Error inserting equipment:", eqError);
        return {
          success: false,
          error: eqError.message,
          data: sample,
        };
      }
    }

    return {
      success: true,
      message: "Sample data loaded successfully (4 facilities, 34 equipment items)",
      data: sample,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to load sample data";
    console.warn("Falling back to local demo sample generation:", errorMsg);
    const sample = generateSampleData("demo-user");
    return {
      success: true,
      message: "Sample data loaded locally (Demo Mode)",
      data: sample,
    };
  }
}
