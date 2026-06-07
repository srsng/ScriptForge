import { NextResponse } from "next/server";
import { assembleGenerationResult, normalizeGenerationRequest } from "@/lib/generation/generate";
import type {
  AnalyzerStageOutput,
  GenerationDiagnostic,
  GenerationStageOutputs,
  PlannerStageOutput,
  PromptBundle,
  ReporterStageOutput,
  ScreenwriterStageOutput,
} from "@/lib/generation/types";
import { finalGenerationResponse, readJsonObject } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const generationRequest = normalizeGenerationRequest(body.request);
    if (!generationRequest) throw new Error("Invalid GenerationRequest payload.");

    const stageOutputs: Required<GenerationStageOutputs> = {
      analyzer: body.analyzer as AnalyzerStageOutput,
      planner: body.planner as PlannerStageOutput,
      screenwriter: body.screenwriter as ScreenwriterStageOutput,
      reporter: body.reporter as ReporterStageOutput,
    };
    if (!stageOutputs.analyzer || !stageOutputs.planner || !stageOutputs.screenwriter || !stageOutputs.reporter) {
      throw new Error("Expected complete stage outputs.");
    }

    const diagnostics = Array.isArray(body.diagnostics) ? body.diagnostics as GenerationDiagnostic[] : [];
    const promptStages = Array.isArray(body.promptStages) ? body.promptStages as PromptBundle[] : [];
    const model = typeof body.model === "string" ? body.model : undefined;
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
    const result = assembleGenerationResult(generationRequest, stageOutputs, diagnostics, promptStages, model);
    return finalGenerationResponse(result, workspaceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
