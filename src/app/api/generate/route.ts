import { NextResponse } from "next/server";
import { normalizeRawNovelInput } from "@/lib/input";
import { generateScriptForgeDocument, normalizeGenerationRequest } from "@/lib/generation/generate";
import { getWorkspace, saveWorkspaceResult } from "@/lib/workspace-data";
import { documentToYaml } from "@/lib/yaml";
import type { GenerationRequest } from "@/types/scriptforge";

export const runtime = "nodejs";

type GenerateBody = {
  workspaceId?: unknown;
  sourceText?: unknown;
  request?: unknown;
  target?: unknown;
  persist?: unknown;
};

function buildRequestFromSource(body: GenerateBody): GenerationRequest | null {
  if (typeof body.sourceText !== "string" || !body.sourceText.trim()) return null;
  const normalization = normalizeRawNovelInput(body.sourceText);
  const target = body.target && typeof body.target === "object" ? body.target as Partial<GenerationRequest["target"]> : {};
  return {
    chapters: normalization.chapters,
    target: {
      format: target.format === "film" || target.format === "stage" ? target.format : "short_drama",
      genre: typeof target.genre === "string" && target.genre.trim() ? target.genre.trim() : "未指定",
      target_duration_minutes: Number.isFinite(Number(target.target_duration_minutes)) ? Number(target.target_duration_minutes) : 12,
      tone: typeof target.tone === "string" && target.tone.trim() ? target.tone.trim() : "紧凑、可拍摄",
    },
  };
}

async function resolveGenerationRequest(body: GenerateBody): Promise<{ request: GenerationRequest; workspaceId?: string }> {
  const direct = normalizeGenerationRequest(body.request ?? body);
  if (direct) return { request: direct };

  if (typeof body.workspaceId === "string" && body.workspaceId.trim()) {
    const workspace = await getWorkspace(body.workspaceId.trim());
    if (!workspace) throw new Error("Workspace not found.");
    return { request: workspace.request, workspaceId: workspace.id };
  }

  const fromSource = buildRequestFromSource(body);
  if (fromSource) return { request: fromSource };

  throw new Error("Expected workspaceId, sourceText, or GenerationRequest payload.");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as GenerateBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object body." }, { status: 400 });
  }

  try {
    const resolved = await resolveGenerationRequest(body);
    const result = await generateScriptForgeDocument(resolved.request);
    const workspaceId = resolved.workspaceId ?? (typeof body.workspaceId === "string" ? body.workspaceId : undefined);

    if (workspaceId && body.persist === true) {
      await saveWorkspaceResult(workspaceId, { result: result.document });
    }

    return NextResponse.json({
      document: result.document,
      validation: result.validation,
      scriptYaml: documentToYaml(result.document),
      diagnostics: result.diagnostics,
      usedFallback: result.status === "fallback",
      status: result.status,
      workspaceId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
