import type { ScriptForgeDocument, ScriptForgeScript } from "@/types/scriptforge";
import type { ValidationResult } from "@/lib/schema";

export type ResultSource = "none" | "ai" | "ai_draft" | "repair" | "manual";

export function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function coerceScriptForgeDocument(value: unknown): ScriptForgeDocument | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  if (candidate.script && typeof candidate.script === "object" && !Array.isArray(candidate.script)) {
    return candidate as unknown as ScriptForgeDocument;
  }

  if (candidate.schema_version === "1.0") {
    return { script: candidate as unknown as ScriptForgeScript };
  }

  return null;
}

export function parseDocumentJson(text: string): ScriptForgeDocument | null {
  if (!text.trim()) return null;

  try {
    return coerceScriptForgeDocument(JSON.parse(text));
  } catch {
    return null;
  }
}

export function validationSummary(validation: ValidationResult | null): string {
  if (!validation) return "未校验";
  if (validation.status === "pass") return "校验通过";
  if (validation.status === "warn") return `通过，${validation.warnings.length} 条警告`;
  return `失败，${validation.errors.length} 条错误`;
}

export function resultSourceLabel(source: ResultSource): string {
  switch (source) {
    case "ai":
      return "AI 生成结果";
    case "ai_draft":
      return "AI 结构化草稿";
    case "repair":
      return "repair 修复结果";
    case "manual":
      return "手动编辑结果";
    case "none":
      return "暂无结果";
  }
}
