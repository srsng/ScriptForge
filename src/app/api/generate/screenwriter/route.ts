import { NextResponse } from "next/server";
import { normalizeGenerationRequest, runScreenwriterStage } from "@/lib/generation/generate";
import type { AnalyzerStageOutput, PlannerStageOutput } from "@/lib/generation/types";
import { readJsonObject, stageResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const generationRequest = normalizeGenerationRequest(body.request);
    if (!generationRequest) throw new Error("章节内容或改编偏好不完整，请检查后再生成。");
    const analyzer = body.analyzer as AnalyzerStageOutput | undefined;
    const planner = body.planner as PlannerStageOutput | undefined;
    if (!analyzer || !planner) throw new Error("前一步生成结果缺失，请从前面的步骤重新生成。");
    const result = await runScreenwriterStage(generationRequest, analyzer, planner);
    return stageResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
