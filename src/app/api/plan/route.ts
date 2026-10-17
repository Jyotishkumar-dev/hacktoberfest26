import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { estimateRuntime } from "@/lib/engine";
import { generateDeterministicPlan, PlanAllocationItem, PlanResult } from "@/lib/engine/planner";
import { Equipment } from "@/types";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      equipment = [] as Equipment[],
      facility_id,
      backup_kwh = 50,
      dod_limit_pct = 80,
      efficiency_pct = 92,
      outage_duration_h = 4,
      user_notes = "",
    } = body;

    // Verify User Session via Supabase or Demo Auth Cookie
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isMock =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("mock.supabase.co");

    const demoAuthCookie = req.cookies.get("gridguard_demo_auth")?.value;

    if (!user && !isMock && !demoAuthCookie) {
      return NextResponse.json({ error: "Unauthorized session" }, { status: 401 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasValidKey = apiKey && apiKey.startsWith("sk-ant-");
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

    let aiRawResponse: Record<string, unknown> | null = null;
    let isFallback = false;

    if (hasValidKey) {
      try {
        const anthropic = new Anthropic({ apiKey });

        const systemPrompt = `You are a power resilience advisor. Given a facility's equipment with priorities and power draws, available backup energy, and a target outage duration, recommend which equipment to keep powered on.
Rules: 1) All P1 equipment stays on unless total P1 load exceeds usable capacity. 2) Maximize runtime while maximizing P1 and P2 coverage. 3) Shed P3 first, then P2 in ascending power-draw order. 4) Return ONLY valid JSON: {allocation:[{id,name,on,reason}], coverage_p1_pct, coverage_p2_pct, estimated_runtime_h, explanation}. 5) The explanation must be plain English for a non-technical facility manager.`;

        const userPayload = {
          facility_id,
          equipment: equipment.map((e: Equipment) => ({
            id: e.id,
            name: e.name,
            power_w: e.power_w,
            priority: e.priority,
            always_on: e.always_on,
            category: e.category,
          })),
          backup_kwh,
          dod: dod_limit_pct,
          efficiency: efficiency_pct,
          outage_duration_h,
          user_notes,
        };

        const message = await anthropic.messages.create({
          model,
          max_tokens: 1500,
          temperature: 0.2,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: JSON.stringify(userPayload),
            },
          ],
        });

        const textContent = message.content[0]?.type === "text" ? message.content[0].text : "";
        
        // Extract JSON block if enclosed in markdown backticks
        const cleanJson = textContent.replace(/```json/g, "").replace(/```/g, "").trim();
        aiRawResponse = JSON.parse(cleanJson);
      } catch (anthropicErr) {
        console.warn("Anthropic API failed or timed out, executing deterministic planner:", anthropicErr);
        isFallback = true;
      }
    } else {
      isFallback = true;
    }

    // -------------------------------------------------------------
    // Server-side Validation & Engine Recomputation
    // -------------------------------------------------------------
    let planResult: PlanResult;

    if (isFallback || !aiRawResponse || !Array.isArray(aiRawResponse.allocation)) {
      planResult = generateDeterministicPlan({
        equipment,
        capacityKwh: backup_kwh,
        dodPct: dod_limit_pct,
        efficiencyPct: efficiency_pct,
        outageDurationH: outage_duration_h,
        userNotes: user_notes,
      });
    } else {
      // Validate every ID and sanitize
      const equipMap = new Map<string, Equipment>(equipment.map((e: Equipment) => [e.id, e]));
      const sanitizedAllocation: PlanAllocationItem[] = [];

      interface RawAlloc {
        id: string;
        name?: string;
        on?: boolean;
        reason?: string;
      }

      const rawAllocList = aiRawResponse.allocation as RawAlloc[];

      // Baseline with everything on
      const totalLoadW = equipment.reduce((sum: number, item: Equipment) => sum + (item.power_w || 0), 0);
      const baselineEst = estimateRuntime({
        capacityKwh: backup_kwh,
        loadW: totalLoadW,
        dodPct: dod_limit_pct,
        efficiencyPct: efficiency_pct,
      });

      rawAllocList.forEach((raw) => {
        const item = equipMap.get(raw.id);
        if (item) {
          let isOn = Boolean(raw.on);

          // Rule 1 Enforcement: If P1 rule is violated without being physically necessary, correct it!
          if (item.priority === "P1" && !isOn) {
            isOn = true;
          }

          sanitizedAllocation.push({
            id: item.id,
            name: item.name,
            on: isOn,
            reason: raw.reason || (isOn ? "Kept powered for operational safety" : "Shed during triage"),
            priority: item.priority,
            power_w: item.power_w,
          });
        }
      });

      // Include any items missing from LLM response
      equipment.forEach((item: Equipment) => {
        if (!sanitizedAllocation.some((a) => a.id === item.id)) {
          sanitizedAllocation.push({
            id: item.id,
            name: item.name,
            on: item.priority === "P1",
            reason: item.priority === "P1" ? "Critical infrastructure preserved" : "Shed to ensure endurance",
            priority: item.priority,
            power_w: item.power_w,
          });
        }
      });

      // DO NOT TRUST the model's numbers: Recompute runtime and coverage using engine
      const activeWatts = sanitizedAllocation.filter((a) => a.on).reduce((sum, a) => sum + a.power_w, 0);
      const recomputedEst = estimateRuntime({
        capacityKwh: backup_kwh,
        loadW: activeWatts,
        dodPct: dod_limit_pct,
        efficiencyPct: efficiency_pct,
      });

      const p1Items = sanitizedAllocation.filter((a) => a.priority === "P1");
      const p1Active = p1Items.filter((a) => a.on).length;
      const p2Items = sanitizedAllocation.filter((a) => a.priority === "P2");
      const p2Active = p2Items.filter((a) => a.on).length;

      const coverage_p1_pct = p1Items.length > 0 ? Math.round((p1Active / p1Items.length) * 100) : 100;
      const coverage_p2_pct = p2Items.length > 0 ? Math.round((p2Active / p2Items.length) * 100) : 100;

      planResult = {
        allocation: sanitizedAllocation,
        coverage_p1_pct,
        coverage_p2_pct,
        estimated_runtime_h: recomputedEst.runtimeH,
        runtime_improvement_h: Number(Math.max(0, recomputedEst.runtimeH - baselineEst.runtimeH).toFixed(2)),
        baseline_runtime_h: baselineEst.runtimeH,
        explanation: (aiRawResponse.explanation as string) || "Optimal load-shedding schedule calculated for target outage.",
        is_fallback: false,
      };
    }

    // Persist to ai_recommendations table if user exists
    if (!isMock && user) {
      await supabase.from("ai_recommendations").insert({
        user_id: user.id,
        facility_id: facility_id || null,
        request_snapshot: { outage_duration_h, backup_kwh, user_notes },
        response: planResult,
      });
    }

    return NextResponse.json(planResult);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Internal planner error";
    console.error("API /api/plan caught exception:", errorMsg);

    // Fallback response with retry flag
    return NextResponse.json(
      {
        error: errorMsg,
        retry: true,
        is_fallback: true,
      },
      { status: 500 }
    );
  }
}
