import type { GenerationRequest, ScriptForgeDocument } from "@/types/scriptforge";
import { MIN_CHAPTER_COUNT } from "@/types/scriptforge";
import { validateScriptForgeDocument } from "@/lib/schema";
import { requestJsonFromModel } from "./client";
import { buildFallbackDocument } from "./fallback";
import { buildGenerationPrompts, flattenForSingleRequest } from "./prompts";
import type { GenerationDiagnostic, GenerationResult } from "./types";

function diagnostic(stage: GenerationDiagnostic["stage"], message: string, severity: GenerationDiagnostic["severity"] = "info"): GenerationDiagnostic {
  return { stage, message, severity };
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
  const duration = Number(target.target_duration_minutes ?? 12);

  return {
    chapters,
    target: {
      format: target.format === "film" || target.format === "stage" ? target.format : "short_drama",
      genre: typeof target.genre === "string" && target.genre.trim() ? target.genre.trim() : "悬疑剧情",
      target_duration_minutes: Number.isFinite(duration) && duration > 0 ? duration : 12,
      tone: typeof target.tone === "string" && target.tone.trim() ? target.tone.trim() : "紧凑、可拍摄",
    },
  };
}

export async function generateScriptForgeDocument(request: GenerationRequest): Promise<GenerationResult> {
  const promptStages = buildGenerationPrompts(request);
  const diagnostics: GenerationDiagnostic[] = [
    diagnostic("analyzer", `接收 ${request.chapters.length} 章小说输入。`),
    diagnostic("planner", `目标：${request.target.format} / ${request.target.genre} / ${request.target.target_duration_minutes} 分钟。`),
  ];

  if (request.chapters.length < MIN_CHAPTER_COUNT) {
    const document = buildFallbackDocument(request, `输入章节少于 ${MIN_CHAPTER_COUNT} 章，启用可校验降级文档。`);
    const validation = validateScriptForgeDocument(document);
    return {
      status: "fallback",
      document,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("fallback", `至少需要 ${MIN_CHAPTER_COUNT} 章有效输入。`, "warning"),
        diagnostic("validation", `降级文档校验状态：${validation.status}。`, validation.valid ? "info" : "error"),
      ],
      promptStages,
    };
  }

  const modelResponse = await requestJsonFromModel(flattenForSingleRequest(promptStages));
  if (!modelResponse.ok) {
    const document = buildFallbackDocument(request, modelResponse.message);
    const validation = validateScriptForgeDocument(document);
    return {
      status: "fallback",
      document,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("screenwriter", modelResponse.message, "warning"),
        diagnostic("fallback", "AI 不可用，返回内置可校验改编文档。", "warning"),
        diagnostic("validation", `降级文档校验状态：${validation.status}。`, validation.valid ? "info" : "error"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const parsed = parseModelJson(modelResponse.content);
  if (!parsed.ok) {
    const document = buildFallbackDocument(request, parsed.message);
    const validation = validateScriptForgeDocument(document);
    return {
      status: "fallback",
      document,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("reporter", parsed.message, "error"),
        diagnostic("fallback", "AI 输出不是合法 JSON，已改用降级文档。", "warning"),
        diagnostic("validation", `降级文档校验状态：${validation.status}。`, validation.valid ? "info" : "error"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const document = coerceDocument(parsed.value);
  const validation = validateScriptForgeDocument(document);
  if (validation.valid) {
    return {
      status: validation.status === "warn" ? "degraded" : "ai_success",
      document,
      validation,
      diagnostics: [
        ...diagnostics,
        diagnostic("screenwriter", "AI 返回 ScriptForgeDocument JSON。"),
        diagnostic("validation", `AI 文档校验状态：${validation.status}。`, validation.status === "warn" ? "warning" : "info"),
      ],
      promptStages,
      model: modelResponse.model,
    };
  }

  const fallback = buildFallbackDocument(request, `AI 文档未通过校验：${validation.errors.map((error) => error.message).slice(0, 3).join("；")}`);
  const fallbackValidation = validateScriptForgeDocument(fallback);
  return {
    status: "fallback",
    document: fallback,
    validation: fallbackValidation,
    diagnostics: [
      ...diagnostics,
      diagnostic("validation", `AI 文档校验失败：${validation.errors.length} 个错误。`, "error"),
      diagnostic("fallback", "返回可校验降级文档，并保留 AI 失败摘要。", "warning"),
      diagnostic("validation", `降级文档校验状态：${fallbackValidation.status}。`, fallbackValidation.valid ? "info" : "error"),
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
