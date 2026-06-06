import { NextResponse } from "next/server";
import { normalizeGenerationRequest, runReporterStage } from "@/lib/generation/generate";
import type { AnalyzerStageOutput, PlannerStageOutput, ScreenwriterStageOutput } from "@/lib/generation/types";
import { readJsonObject, stageResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const generationRequest = normalizeGenerationRequest(body.request);
    if (!generationRequest) throw new Error("Invalid GenerationRequest payload.");
    const analyzer = body.analyzer as AnalyzerStageOutput | undefined;
    const planner = body.planner as PlannerStageOutput | undefined;
    const screenwriter = body.screenwriter as ScreenwriterStageOutput | undefined;
    if (!analyzer) throw new Error("Expected analyzer stage output.");
    if (!planner) throw new Error("Expected planner stage output.");
    if (!screenwriter) throw new Error("Expected screenwriter stage output.");
    const result = await runReporterStage(generationRequest, analyzer, planner, screenwriter);
    return stageResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
