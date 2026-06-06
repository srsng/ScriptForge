import { NextResponse } from "next/server";
import { normalizeGenerationRequest, runAnalyzerStage } from "@/lib/generation/generate";
import { readJsonObject, stageResponse } from "../_shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await readJsonObject(request);
    const generationRequest = normalizeGenerationRequest(body.request ?? body);
    if (!generationRequest) throw new Error("Invalid GenerationRequest payload.");
    const result = await runAnalyzerStage(generationRequest);
    return stageResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ status: "error", error: message }, { status: 400 });
  }
}
