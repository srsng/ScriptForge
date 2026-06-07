import { NextResponse } from "next/server";
import { normalizeGenerationRequest, runReporterStage } from "@/lib/generation/generate";
import type { AnalyzerStageOutput, PlannerStageOutput, ScreenwriterStageOutput } from "@/lib/generation/types";
import { readJsonObject, stageResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const generationRequest = normalizeGenerationRequest(body.request);
    if (!generationRequest) throw new Error("章节内容或改编偏好不完整，请检查后再生成。");
    const analyzer = body.analyzer as AnalyzerStageOutput | undefined;
    const planner = body.planner as PlannerStageOutput | undefined;
    const screenwriter = body.screenwriter as ScreenwriterStageOutput | undefined;
    if (!analyzer || !planner || !screenwriter) throw new Error("前一步生成结果缺失，请从前面的步骤重新生成。");
    const result = await runReporterStage(generationRequest, analyzer, planner, screenwriter);
    return stageResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
