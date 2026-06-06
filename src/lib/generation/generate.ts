import type { GenerationRequest, ScriptForgeDocument } from "@/types/scriptforge";
import { MIN_CHAPTER_COUNT } from "@/types/scriptforge";
import { validateScriptForgeDocument } from "@/lib/schema";
import { requestJsonFromModel } from "./client";
import { buildGenerationPrompts, flattenForSingleRequest } from "./prompts";
import { evaluateScriptDensity } from "./quality";
import type { GenerationDiagnostic, GenerationResult } from "./types";

function diagnostic(
  stage: GenerationDiagnostic["stage"],
  message: string,
  severity: GenerationDiagnostic["severity"] = "info",
  kind?: GenerationDiagnostic["kind"],
): GenerationDiagnostic {
  return { stage, message, severity, kind };
}

export function normalizeTargetDuration(value: unknown, defaultDuration = 12): number | null {
  if (value === undefined || value === null) return defaultDuration;
  if (typeof value === "string" && value.trim().length === 0) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 180 ? duration : null;
}

export function normalizeGenerationRequest(input: unknown): GenerationRequest | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<GenerationRequest>;
  if (!Array.isArray(candidate.chapters) || !candidate.target || typeof candidate.target !== "object") return null;

  const chapters = candidate.chapters
    .map((chapter, index) => {
      if (!chapter || typeof chapter !== "object") return null;
      const value = chapter as { id?: unknown; title?: unknown; content?: unknown };
      const content = typeof value.content === "string" ? value.content.trim() : "";
      if (!content) return null;
      return {
        id: typeof value.id === "string" && value.id.trim() ? value.id.trim() : `ch_${String(index + 1).padStart(3, "0")}`,
        title: typeof value.title === "string" && value.title.trim() ? value.title.trim() : `第 ${index + 1} 章`,
        content,
      };
    })
    .filter((chapter): chapter is GenerationRequest["chapters"][number] => chapter !== null);

  const target = candidate.target as Partial<GenerationRequest["target"]>;
  const duration = normalizeTargetDuration(target.target_duration_minutes);
  if (duration === null) return null;

  return {
    chapters,
    target: {
      format: target.format === "film" || target.format === "stage" ? target.format : "short_drama",
      genre: typeof target.genre === "string" && target.genre.trim() ? target.genre.trim() : "悬疑剧情",
      target_duration_minutes: duration,
      tone: typeof target.tone === "string" && target.tone.trim() ? target.tone.trim() : "紧凑、可拍摄",
    },
  };
}

export async function generateScriptForgeDocument(request: GenerationRequest): Promise<GenerationResult> {
  if (request.chapters.length < MIN_CHAPTER_COUNT) {
    throw new Error(`至少需要 ${MIN_CHAPTER_COUNT} 章有效输入。`);
  }

  const promptStages = buildGenerationPrompts(request);
  const diagnostics: GenerationDiagnostic[] = [
    diagnostic("analyzer", `接收 ${request.chapters.length} 章小说输入。`),
    diagnostic("planner", `目标：${request.target.format} / ${request.target.genre} / ${request.target.target_duration_minutes} 分钟。`),
  ];

  const modelResponse = await requestJsonFromModel(flattenForSingleRequest(promptStages));
  if (!modelResponse.ok) {
    const message = modelResponse.message || "AI 生成请求失败。";
    return {
      status: "error",
      error: message,
      diagnostics: [
        ...diagnostics,
        diagnostic("screenwriter", message, "error", modelResponse.status ? "network" : "configuration"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const parsed = parseModelJson(modelResponse.content);
  if (!parsed.ok) {
    return {
      status: "error",
      error: parsed.message,
      diagnostics: [
        ...diagnostics,
        diagnostic("reporter", parsed.message, "error", "parse"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const document = coerceDocument(parsed.value);
  const validation = validateScriptForgeDocument(document);
  if (validation.valid) {
    const qualityDiagnostics = evaluateScriptDensity(document, request);
    const hasQualityError = qualityDiagnostics.some((item) => item.severity === "error");
    const hasWarning = validation.status === "warn" || qualityDiagnostics.some((item) => item.severity === "warning");
    return {
      status: hasQualityError ? "needs_revision" : hasWarning ? "degraded" : "ai_success",
      document,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("screenwriter", "AI 返回 ScriptForgeDocument JSON。"),
        diagnostic("validation", `AI 文档校验状态：${validation.status}。`, validation.status === "warn" ? "warning" : "info"),
        ...qualityDiagnostics,
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const error = `AI 文档未通过 Schema 或引用校验：${validation.errors.map((item) => item.message).slice(0, 3).join("；")}`;
  return {
    status: "error",
    error,
    validation,
    diagnostics: [
      ...diagnostics,
      diagnostic("validation", `AI 文档校验失败：${validation.errors.length} 个错误。`, "error", "schema"),
    ],
    promptStages,
    model: modelResponse.model,
  };
}

function parseModelJson(content: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `AI JSON 解析失败：${message}` };
  }
}

function coerceDocument(value: unknown): ScriptForgeDocument {
  if (value && typeof value === "object") {
    const objectValue = value as { document?: unknown; script?: unknown };
    if (objectValue.document && typeof objectValue.document === "object") {
      return objectValue.document as ScriptForgeDocument;
    }
    if (objectValue.script && typeof objectValue.script === "object") {
      return value as ScriptForgeDocument;
    }
  }
  return { script: value as ScriptForgeDocument["script"] };
}
