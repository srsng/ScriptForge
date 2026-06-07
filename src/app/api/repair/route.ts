import { NextResponse } from "next/server";
import {
  validateScriptForgeDocument,
  validateScriptForgeYaml,
} from "@/lib/schema";
import {
  repairScriptForgeDocument,
  repairScriptForgeYaml,
  type RepairResult,
} from "@/lib/repair";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "提交内容格式不正确，请检查后重试。" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求内容不完整，请刷新页面后重试。" }, { status: 400 });
  }

  // Accept {yamlText} for YAML repair
  if (typeof body.yamlText === "string") {
    const validation = validateScriptForgeYaml(body.yamlText);
    const result: RepairResult = repairScriptForgeYaml(body.yamlText, validation);
    return NextResponse.json(result);
  }

  // Accept {document}, top-level document, or a bare script object.
  const document = normalizeRepairDocumentInput(body.document ?? body);
  const validation = body.validation
    ? (body.validation as Parameters<typeof repairScriptForgeDocument>[1])
    : validateScriptForgeDocument(document);

  const result: RepairResult = repairScriptForgeDocument(document, validation);
  return NextResponse.json(result);
}

function normalizeRepairDocumentInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;

  const candidate = input as Record<string, unknown>;
  if (candidate.script && typeof candidate.script === "object" && !Array.isArray(candidate.script)) {
    return candidate;
  }

  if (candidate.schema_version === "1.1") {
    return { script: candidate };
  }

  return candidate;
}
