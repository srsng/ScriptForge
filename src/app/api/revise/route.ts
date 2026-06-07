import { NextResponse } from "next/server";
import { validateScriptForgeDocument } from "@/lib/schema";
import { normalizeGenerationRequest } from "@/lib/generation/generate";
import { reviseScriptForgeDocument } from "@/lib/generation/revise";
import { documentToYaml } from "@/lib/yaml";
import type { RevisionRequest } from "@/lib/generation/types";
import type { ScriptForgeDocument } from "@/types/scriptforge";

export const runtime = "nodejs";

type ReviseBody = {
  request?: unknown;
  document?: unknown;
  directions?: unknown;
};

function normalizeDirections(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error("改写要求格式不正确，请重新选择要应用的建议。");
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

function normalizeRevisionRequest(body: ReviseBody): RevisionRequest {
  const request = normalizeGenerationRequest(body.request);
  if (!request) throw new Error("章节内容或改编偏好不完整，请检查后再改写。");

  if (!body.document || typeof body.document !== "object" || Array.isArray(body.document)) {
    throw new Error("Expected current ScriptForgeDocument.");
  }

  const document = body.document as ScriptForgeDocument;
  const validation = validateScriptForgeDocument(document);
  if (!validation.valid) {
    throw new Error("当前剧本还有校验问题，请先按提示修正后再改写。");
  }

  return {
    request,
    document,
    directions: normalizeDirections(body.directions),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as ReviseBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求内容不完整，请刷新页面后重试。" }, { status: 400 });
  }

  try {
    const revisionRequest = normalizeRevisionRequest(body);
    const result = await reviseScriptForgeDocument(revisionRequest);
    const resultSource = result.status === "needs_revision" ? "ai_draft" : result.document ? "ai" : "none";

    return NextResponse.json({
      document: result.document,
      validation: result.validation,
      scriptYaml: result.document ? documentToYaml(result.document) : undefined,
      diagnostics: result.diagnostics,
      error: result.error,
      resultSource,
      status: result.status,
    }, { status: result.status === "error" ? 502 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
