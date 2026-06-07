import type { ScriptForgeDocument, ScriptForgeScript } from "@/types/scriptforge";
import type { ValidationResult, ValidationError } from "@/lib/schema";

type PathIndexes = {
  chapter?: number;
  fact?: number;
  scene?: number;
  beat?: number;
  character?: number;
  location?: number;
  reportItem?: number;
};

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

  if (candidate.schema_version === "1.1") {
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

export function userFacingIssueMessage(issue: Pick<ValidationError, "message" | "path">): string {
  const message = issue.message.trim();

  if (/Invalid JSON/i.test(message)) return "返回内容解析失败，请重新生成一次。";

  return message
    .replace(/Schema/gi, "当前剧本格式")
    .replace(/adaptation_report/gi, "改编说明")
    .replace(/adaptation_notes/gi, "场景说明")
    .replace(/revision_suggestions/gi, "后续修改建议")
    .replace(/chapter_count/gi, "章节数量")
    .replace(/scene_count/gi, "场景数量")
    .replace(/character_count/gi, "人物数量")
    .replace(/key_facts/gi, "关键信息")
    .replace(/source_refs/gi, "引用依据")
    .replace(/source_chapters/gi, "关联章节")
    .replace(/schema_version/gi, "文档版本")
    .replace(/dramatic_purpose/gi, "戏剧目标")
    .replace(/main_conflicts/gi, "核心冲突")
    .replace(/omitted_or_compressed/gi, "删减说明")
    .replace(/rationale/gi, "改编理由")
    .replace(/scene_card/gi, "场景卡")
    .replace(/entry_state/gi, "入场状态")
    .replace(/turning_point/gi, "转折点")
    .replace(/exit_state/gi, "离场状态")
    .replace(/visual_atmosphere/gi, "画面氛围")
    .replace(/beats/gi, "剧本段落");
}

export function formatValidationPath(path?: string | null): string {
  if (!path) return "整体";

  const indexes = extractPathIndexes(path);
  const normalized = path.replaceAll("/", ".");

  if (normalized.includes("script.source.chapters")) {
    return joinPathLabel([
      "原文章节",
      ordinalLabel("第", indexes.chapter, "章"),
      normalized.includes("key_facts") ? "关键信息" : null,
      normalized.includes("key_facts") ? ordinalLabel("第", indexes.fact, "条") : null,
      userFacingFieldLabel(normalized),
    ]);
  }

  if (normalized.includes("script.scenes")) {
    return joinPathLabel([
      "剧本场景",
      ordinalLabel("第", indexes.scene, "个场景"),
      normalized.includes("beats") ? "剧本段落" : null,
      normalized.includes("beats") ? ordinalLabel("第", indexes.beat, "段") : null,
      userFacingFieldLabel(normalized),
    ]);
  }

  if (normalized.includes("script.characters")) {
    return joinPathLabel(["人物设定", ordinalLabel("第", indexes.character, "个人物"), userFacingFieldLabel(normalized)]);
  }

  if (normalized.includes("script.locations")) {
    return joinPathLabel(["地点设定", ordinalLabel("第", indexes.location, "个地点"), userFacingFieldLabel(normalized)]);
  }

  if (normalized.includes("adaptation_report")) {
    return joinPathLabel([
      "改编说明",
      userFacingFieldLabel(normalized),
      normalized.includes("revision_suggestions") ? ordinalLabel("第", indexes.reportItem, "条") : null,
    ]);
  }

  if (normalized.includes("script.source")) return joinPathLabel(["原文资料", userFacingFieldLabel(normalized)]);
  if (normalized.includes("script")) return joinPathLabel(["剧本初稿", userFacingFieldLabel(normalized)]);

  return userFacingFieldLabel(normalized) ?? "整体";
}

function extractPathIndexes(path: string): PathIndexes {
  return {
    chapter: extractPathIndex(path, /chapters\[(\d+)\]|chapters\.(\d+)|chapters\/(\d+)/),
    fact: extractPathIndex(path, /key_facts\[(\d+)\]|key_facts\.(\d+)|key_facts\/(\d+)/),
    scene: extractPathIndex(path, /scenes\[(\d+)\]|scenes\.(\d+)|scenes\/(\d+)/),
    beat: extractPathIndex(path, /beats\[(\d+)\]|beats\.(\d+)|beats\/(\d+)/),
    character: extractPathIndex(path, /characters\[(\d+)\]|characters\.(\d+)|characters\/(\d+)/),
    location: extractPathIndex(path, /locations\[(\d+)\]|locations\.(\d+)|locations\/(\d+)/),
    reportItem: extractPathIndex(path, /revision_suggestions\[(\d+)\]|revision_suggestions\.(\d+)|revision_suggestions\/(\d+)/),
  };
}

function extractPathIndex(path: string, pattern: RegExp): number | undefined {
  const match = path.match(pattern);
  if (!match) return undefined;
  const raw = match.slice(1).find((value): value is string => typeof value === "string");
  if (!raw) return undefined;
  const index = Number.parseInt(raw, 10);
  return Number.isFinite(index) ? index + 1 : undefined;
}

function ordinalLabel(prefix: string, value: number | undefined, suffix: string): string | null {
  return typeof value === "number" ? `${prefix}${value}${suffix}` : null;
}

function joinPathLabel(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

function userFacingFieldLabel(path: string): string | null {
  if (path.includes("revision_suggestions")) return "后续修改建议";
  if (path.includes("main_conflicts")) return "核心冲突";
  if (path.includes("omitted_or_compressed")) return "删减说明";
  if (path.includes("rationale")) return "改编理由";
  if (path.includes("chapter_count")) return "章节数量";
  if (path.includes("scene_count")) return "场景数量";
  if (path.includes("character_count")) return "人物数量";
  if (path.includes("source_refs")) return "引用依据";
  if (path.includes("source_chapters")) return "关联章节";
  if (path.includes("key_facts")) return "关键信息";
  if (path.includes("characters")) return "出场人物";
  if (path.includes("location")) return "地点";
  if (path.includes("beats")) return "剧本段落";
  if (path.includes("title")) return "标题";
  if (path.includes("summary")) return "摘要";
  if (path.includes("description")) return "说明";
  if (path.includes("dialogue")) return "对白";
  if (path.includes("action")) return "动作";
  return null;
}

export function validationSummary(validation: ValidationResult | null): string {
  if (!validation) return "未检查";
  if (validation.status === "pass") return "检查通过";
  if (validation.status === "warn") return `通过，${validation.warnings.length} 条提醒`;
  return `未通过，${validation.errors.length} 条问题`;
}

export function resultSourceLabel(source: ResultSource): string {
  switch (source) {
    case "ai":
      return "已生成剧本初稿";
    case "ai_draft":
      return "待打磨初稿";
    case "repair":
      return "已整理初稿";
    case "manual":
      return "手动编辑版本";
    case "none":
      return "暂无剧本初稿";
  }
}
