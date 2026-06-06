import { NextResponse } from "next/server";
import { documentToYaml } from "@/lib/yaml";
import type { GenerationResult, GenerationStageResult } from "@/lib/generation/types";

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Expected JSON object body.");
  }
  return body as Record<string, unknown>;
}

export function stageResponse<T>(result: GenerationStageResult<T>) {
  if (result.status === "error") {
    return NextResponse.json({
      status: "error",
      error: result.error,
      diagnostics: result.diagnostics,
      metrics: result.metrics,
      model: result.model,
    }, { status: 502 });
  }

  return NextResponse.json({
    status: "ok",
    output: result.output,
    diagnostics: result.diagnostics,
    prompt: result.prompt,
    metrics: result.metrics,
    model: result.model,
  });
}

export function finalGenerationResponse(result: GenerationResult, workspaceId?: string) {
  const resultSource = result.status === "needs_revision" ? "ai_draft" : result.document ? "ai" : "none";
  return NextResponse.json({
    document: result.document,
    validation: result.validation,
    scriptYaml: result.document ? documentToYaml(result.document) : undefined,
    diagnostics: result.diagnostics,
    stageOutputs: result.stageOutputs,
    error: result.error,
    resultSource,
    status: result.status,
    workspaceId,
  }, { status: result.status === "error" ? 502 : 200 });
}
