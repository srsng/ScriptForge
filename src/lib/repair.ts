/**
 * M5 — 自动修复与容错
 *
 * 针对 Schema 校验 / M2 引用校验中可自动修复的部分，基于文档已有数据
 *（characters、locations、source.chapters）进行修补，不凭空重写故事。
 */

import type { ValidationError, ValidationResult } from "@/lib/schema/types";
import type {
  ScriptForgeDocument,
  ScriptCharacter,
  ScriptBeat,
  SourceFactType,
} from "@/types/scriptforge";
import { dump as dumpYaml, load as parseYaml } from "js-yaml";

// ── Public Types ────────────────────────────────────────────────────────────

export type RepairStatus = "ok" | "partial" | "failed";

export type AppliedFix = {
  path: string;
  type: "add_required" | "fix_type" | "fix_reference" | "fill_default" | "remove_field";
  message: string;
  description: string;
};

type AppliedFixDraft = Omit<AppliedFix, "description"> & { description?: string };

function appliedFix(script: Record<string, unknown>, fix: AppliedFixDraft): AppliedFix {
  const missingProp = fix.type === "add_required" ? extractAddedPropertyFromFix(fix) : null;
  const path = repairDisplayPath(script, fix.path, missingProp ?? undefined);
  return {
    ...fix,
    path,
    description: fix.description ?? fix.message,
  };
}

function extractAddedPropertyFromFix(fix: AppliedFixDraft): string | null {
  const requiredMatch = fix.message.match(/必填字段\s+"([^"]+)"/);
  if (requiredMatch) return requiredMatch[1];

  const sourceMatch = fix.message.match(/添加\s+source\.(type|chapters)\b/);
  return sourceMatch?.[1] ?? null;
}

export type RepairResult = {
  document?: ScriptForgeDocument;
  yamlText?: string;
  diagnostics: ValidationError[];
  appliedFixes: AppliedFix[];
  status: RepairStatus;
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Repair a ScriptForgeDocument given validation errors.
 * Returns repaired document + diagnostics + applied fixes.
 */
export function repairScriptForgeDocument(
  data: unknown,
  validation: ValidationResult,
): RepairResult {
  const doc = deepClone(data) as Record<string, unknown>;
  const diagnostics: ValidationError[] = [];
  const appliedFixes: AppliedFixDraft[] = [];

  if (!doc || typeof doc !== "object") {
    return {
      diagnostics: [
        { path: "$", message: "输入不是有效对象。", source: "schema", severity: "error", keyword: "type" },
      ],
      appliedFixes: [],
      status: "failed",
    };
  }

  let script: Record<string, unknown>;
  if (doc.script && typeof doc.script === "object") {
    script = doc.script as Record<string, unknown>;
  } else {
    diagnostics.push({
      path: "$",
      message: "文档缺少 script 字段且不是合法的 ScriptForgeScript。",
      source: "schema",
      severity: "error",
      keyword: "required",
    });
    return { diagnostics, appliedFixes: [], status: "failed" };
  }

  const errors = [...(validation.errors ?? []), ...(validation.warnings ?? [])];

  // ── 1. Fix schema missing required fields ──────────────────────────────────
  for (const err of errors) {
    if (err.keyword === "required" && err.severity === "error") {
      const fix = fixMissingRequiredField(script, err);
      if (fix) {
        appliedFixes.push(fix);
      } else {
        diagnostics.push(err);
      }
    }
  }

  // ── 2. Fix schema type errors ──────────────────────────────────────────────
  for (const err of errors) {
    if (err.keyword === "type" && err.severity === "error") {
      const fix = fixTypeError(script, err);
      if (fix) {
        appliedFixes.push(fix);
      } else {
        diagnostics.push(err);
      }
    }
  }

  // ── 3. Fix M2 reference errors ────────────────────────────────────────────
  // Schema validation can stop before M2 reference validation when required/type
  // errors exist. Re-scan references after structural fixes so one repair call
  // can still heal dangling IDs without inventing story content.
  const referenceErrors = mergeValidationErrors(
    errors.filter((err) => err.keyword === "reference" && err.severity === "error"),
    collectRepairableReferenceErrors(script),
  );

  const characterIds = collectStringIds(script.characters);
  const locationIds = collectStringIds(script.locations);
  const chapterIds = collectStringIds((script.source as Record<string, unknown> | undefined)?.chapters);
  const factIds = collectFactIds((script.source as Record<string, unknown> | undefined)?.chapters);

  for (const err of referenceErrors) {
    const fix = fixReferenceError(script, err, characterIds, locationIds, chapterIds, factIds);
    if (fix) {
      appliedFixes.push(fix);
    } else {
      diagnostics.push(err);
    }
  }

  // ── 4. Fix missing array defaults (minItems) ──────────────────────────────
  for (const err of errors) {
    if (err.keyword === "minItems" && err.severity === "error") {
      const fix = fixMinItems(script, err);
      if (fix) {
        appliedFixes.push(fix);
      }
    }
  }

  // Build final document
  const repairedDocument = { script } as ScriptForgeDocument;
  const remainingErrors = mergeValidationErrors(errors, referenceErrors).filter((e) =>
    !appliedFixes.some((f) => f.type !== "remove_field" && appliedFixMatchesError(script, f, e)),
  );

  const status: RepairStatus =
    remainingErrors.filter((e) => e.severity === "error").length === 0
      ? appliedFixes.length > 0 ? "ok" : "ok"
      : appliedFixes.length > 0 ? "partial" : "failed";

  return {
    document: repairedDocument,
    diagnostics: remainingErrors,
    appliedFixes: appliedFixes.map((fix) => appliedFix(script, fix)),
    status,
  };
}

/**
 * Repair a YAML text string: parse → repair → re-dump.
 */
export function repairScriptForgeYaml(
  yamlText: string,
  validation: ValidationResult,
): RepairResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    return {
      diagnostics: [
        {
          path: "$",
          message: `YAML 解析失败：${err instanceof Error ? err.message : String(err)}`,
          source: "yaml",
          severity: "error",
          keyword: "parse",
        },
      ],
      appliedFixes: [],
      status: "failed",
    };
  }

  const result = repairScriptForgeDocument(parsed, validation);
  if (result.document) {
    result.yamlText = dumpYaml(result.document, {
      sortKeys: false,
      noRefs: true,
      lineWidth: -1,
      quotingType: '"',
      forceQuotes: false,
    });
  }
  return result;
}

// ── Internal Repair Helpers ─────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function normalizeRepairPath(path: string): string {
  if (!path || path === "$") return "$";

  const pointerToDotPath = (rawPath: string): string => {
    const segments = rawPath
      .replace(/^\$?\//, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));

    const dotPath = segments.reduce((acc, segment) => {
      if (/^\d+$/.test(segment)) return `${acc}[${segment}]`;
      return acc === "$" ? `$.${segment}` : `${acc}.${segment}`;
    }, "$");

    return dotPath || "$";
  };

  const normalized = path.includes("/") ? pointerToDotPath(path) : path;
  return normalized.replace(/^\$\.script(?=\.|\[|$)/, "$") || "$";
}

function collectStringIds(items: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(items)) return ids;

  for (const item of items) {
    if (typeof item === "string" && item.trim().length > 0) {
      ids.add(item);
      continue;
    }

    if (item && typeof item === "object") {
      const id = (item as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim().length > 0) ids.add(id);
    }
  }

  return ids;
}

function collectFactIds(chapters: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(chapters)) return ids;

  for (const chapter of chapters) {
    if (!chapter || typeof chapter !== "object") continue;
    const facts = (chapter as Record<string, unknown>).key_facts;
    if (!Array.isArray(facts)) continue;

    for (const fact of facts) {
      if (!fact || typeof fact !== "object") continue;
      const id = (fact as Record<string, unknown>).id;
      if (typeof id === "string" && id.trim().length > 0) ids.add(id);
    }
  }

  return ids;
}

function mergeValidationErrors(...groups: ValidationError[][]): ValidationError[] {
  const merged: ValidationError[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const err of group) {
      const key = [
        normalizeRepairPath(err.path),
        err.source,
        err.severity,
        err.keyword ?? "",
        err.message,
      ].join("\u0000");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(err);
    }
  }

  return merged;
}

function repairReferenceError(path: string, message: string): ValidationError {
  return {
    path,
    message,
    source: "reference",
    severity: "error",
    keyword: "reference",
  };
}

function collectRepairableReferenceErrors(script: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const characterIds = collectStringIds(script.characters);
  const locationIds = collectStringIds(script.locations);
  const source = script.source as Record<string, unknown> | undefined;
  const chapterIds = collectStringIds(source?.chapters);
  const factIds = collectFactIds(source?.chapters);

  const scenes = Array.isArray(script.scenes) ? script.scenes as Record<string, unknown>[] : [];
  for (const [si, scene] of scenes.entries()) {
    if (!scene || typeof scene !== "object") continue;

    const location = scene.location;
    if (typeof location === "string" && locationIds.size > 0 && !locationIds.has(location)) {
      errors.push(repairReferenceError(
        `$.script.scenes[${si}].location`,
        `场景地点 "${location}" 不在 locations 中。`,
      ));
    }

    const characters = Array.isArray(scene.characters) ? scene.characters : [];
    for (const [ci, charId] of characters.entries()) {
      if (typeof charId === "string" && characterIds.size > 0 && !characterIds.has(charId)) {
        errors.push(repairReferenceError(
          `$.script.scenes[${si}].characters[${ci}]`,
          `场景角色 "${charId}" 不在 characters 中。`,
        ));
      }
    }

    const sourceChapters = Array.isArray(scene.source_chapters) ? scene.source_chapters : [];
    for (const [chi, chId] of sourceChapters.entries()) {
      if (typeof chId === "string" && chapterIds.size > 0 && !chapterIds.has(chId)) {
        errors.push(repairReferenceError(
          `$.script.scenes[${si}].source_chapters[${chi}]`,
          `来源章节 "${chId}" 不在 source.chapters 中。`,
        ));
      }
    }

    const sourceRefs = Array.isArray(scene.source_refs) ? scene.source_refs : [];
    for (const [ri, factId] of sourceRefs.entries()) {
      if (typeof factId === "string" && factIds.size > 0 && !factIds.has(factId)) {
        errors.push(repairReferenceError(
          `$.script.scenes[${si}].source_refs[${ri}]`,
          `场景来源事实 "${factId}" 不存在。`,
        ));
      }
    }

    const beats = Array.isArray(scene.beats) ? scene.beats as Record<string, unknown>[] : [];
    for (const [bi, beat] of beats.entries()) {
      if (!beat || typeof beat !== "object") continue;
      const beatType = beat.type;
      const character = beat.character;
      if (beatType === "dialogue" && typeof character === "string" && characterIds.size > 0 && !characterIds.has(character)) {
        errors.push(repairReferenceError(
          `$.script.scenes[${si}].beats[${bi}].character`,
          `对白角色 "${character}" 不在 characters 中。`,
        ));
      }

      const beatSourceRefs = Array.isArray(beat.source_refs) ? beat.source_refs : [];
      for (const [ri, factId] of beatSourceRefs.entries()) {
        if (typeof factId === "string" && factIds.size > 0 && !factIds.has(factId)) {
          errors.push(repairReferenceError(
            `$.script.scenes[${si}].beats[${bi}].source_refs[${ri}]`,
            `片段来源事实 "${factId}" 不存在。`,
          ));
        }
      }
    }
  }

  const characters = Array.isArray(script.characters) ? script.characters as Record<string, unknown>[] : [];
  for (const [ci, character] of characters.entries()) {
    if (!character || typeof character !== "object") continue;
    const relationships = Array.isArray(character.relationships) ? character.relationships as Record<string, unknown>[] : [];
    for (const [ri, rel] of relationships.entries()) {
      if (!rel || typeof rel !== "object") continue;
      const target = rel.target;
      if (typeof target === "string" && characterIds.size > 0 && !characterIds.has(target)) {
        errors.push(repairReferenceError(
          `$.script.characters[${ci}].relationships[${ri}].target`,
          `关系目标 "${target}" 不在 characters 中。`,
        ));
      }
    }
  }

  return errors;
}

function repairDisplayPath(script: Record<string, unknown>, path: string, missingProp?: string): string {
  const normalized = normalizeRepairPath(path);
  const withMissing = missingProp && !normalized.endsWith(`.${missingProp}`)
    ? `${normalized}.${missingProp}`
    : normalized;

  return withMissing.replace(/\.scenes\[(\d+)\]/g, (match, idxText) => {
    const scene = (script.scenes as Record<string, unknown>[] | undefined)?.[Number(idxText)];
    const sceneId = scene?.id;
    return typeof sceneId === "string" && sceneId.length > 0 ? `${match}.${sceneId}` : match;
  });
}

function appliedFixMatchesError(
  script: Record<string, unknown>,
  fix: AppliedFixDraft,
  err: ValidationError,
): boolean {
  if (fix.path === err.path) return true;

  const fixPath = normalizeRepairPath(fix.path);
  const errPath = normalizeRepairPath(err.path);
  if (fixPath === errPath) return true;

  const missingProp = err.keyword === "required" ? extractMissingProperty(err) : null;
  if (missingProp && fixPath === `${errPath}.${missingProp}`) return true;

  return fix.path === repairDisplayPath(script, err.path, missingProp ?? undefined);
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  // Simple path like "$.characters" or "$.scenes[0].location"; schema paths may arrive as "$/script/scenes/0".
  const parts = normalizeRepairPath(path).replace(/^\$\.?/, "").split(/\./);
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, indexStr] = arrayMatch;
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[Number(indexStr)];
    } else if (part) {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function fixMissingRequiredField(
  script: Record<string, unknown>,
  err: ValidationError,
): AppliedFixDraft | null {
  // Normalize schema paths (Ajv JSON Pointer or dot path) for internal checks.
  const path = normalizeRepairPath(err.path);
  const missingProp = extractMissingProperty(err);

  // Top-level script required fields
  const scriptRequiredFields: Record<string, unknown> = {
    schema_version: "1.1",
    title: "未命名剧本",
    metadata: {
      language: "zh-CN",
      format: "short_drama",
      genre: "未指定",
      target_duration_minutes: 12,
      logline: "该剧本需补充核心冲突概括。",
      tone: "未指定",
    },
    source: { type: "novel", chapters: [] },
    characters: [],
    locations: [],
    scenes: [],
    adaptation_report: {
      chapter_count: 0,
      scene_count: 0,
      character_count: 0,
      main_conflicts: [],
      omitted_or_compressed: [],
      revision_suggestions: [],
    },
  };

  if (path === "$.script" || path === "$") {
    if (missingProp && missingProp in scriptRequiredFields) {
      script[missingProp] = deepClone(scriptRequiredFields[missingProp]);
      return {
        path: path,
        type: "add_required",
        message: `添加必填字段 "${missingProp}"。`,
      };
    }
  }

  // metadata required fields
  if (path.startsWith("$.script.metadata") || path.startsWith("$.metadata")) {
    const metaDefaults: Record<string, unknown> = {
      language: "zh-CN",
      format: "short_drama",
      genre: "未指定",
      target_duration_minutes: 12,
      logline: "需补充核心冲突概括。",
      tone: "未指定",
    };
    if (missingProp && missingProp in metaDefaults) {
      if (!script.metadata || typeof script.metadata !== "object") script.metadata = {};
      (script.metadata as Record<string, unknown>)[missingProp] = metaDefaults[missingProp];
      return {
        path: path,
        type: "add_required",
        message: `添加 metadata 必填字段 "${missingProp}"。`,
      };
    }
  }

  // source required fields (type, chapters)
  if (path.includes("source")) {
    if (!script.source) script.source = { type: "novel", chapters: [] };
    const src = script.source as Record<string, unknown>;
    if (missingProp === "type" && !src.type) {
      src.type = "novel";
      return { path: path, type: "add_required", message: `添加 source.type = "novel"。` };
    }
    if (missingProp === "chapters" && !src.chapters) {
      src.chapters = [];
      return { path: path, type: "add_required", message: `添加 source.chapters（空数组）。` };
    }
  }

  // scene-level required fields
  const sceneIdxMatch = path.match(/scenes\[(\d+)\]/);
  if (sceneIdxMatch) {
    const idx = Number(sceneIdxMatch[1]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[idx] as Record<string, unknown> ?? {};
    const sceneDefaults: Record<string, unknown> = {
      id: `scene_${String(idx + 1).padStart(3, "0")}`,
      title: `场景 ${idx + 1}`,
      source_chapters: [],
      source_refs: [],
      location: "",
      time: "未知",
      characters: [],
      scene_card: {
        objective: "需补充场景目标。",
        opposition: "需补充场景阻碍。",
        entry_state: "需补充入场状态。",
        turning_point: "需补充场内转折。",
        exit_state: "需补充离场状态。",
        visual_atmosphere: "需补充场景氛围。",
      },
      dramatic_purpose: "需补充戏剧目的。",
      conflict: "需补充冲突。",
      beats: [],
    };
    if (missingProp && missingProp in sceneDefaults) {
      scene[missingProp] = deepClone(sceneDefaults[missingProp]);
      return {
        path: path,
        type: "add_required",
        message: `添加 scenes[${idx}] 必填字段 "${missingProp}"。`,
      };
    }
  }

  // character-level required fields
  const charIdxMatch = path.match(/characters\[(\d+)\]/);
  if (charIdxMatch) {
    const idx = Number(charIdxMatch[1]);
    const chars = script.characters as Record<string, unknown>[] ?? [];
    const char = chars[idx] as Record<string, unknown> ?? {};
    const charDefaults: Record<string, unknown> = {
      id: `char_${String(idx + 1).padStart(3, "0")}`,
      name: `角色${idx + 1}`,
      role: "unknown",
      description: "需补充描述。",
      motivation: "需补充动机。",
      arc: "需补充弧光。",
      voice: "需补充对白风格。",
    };
    if (missingProp && missingProp in charDefaults) {
      char[missingProp] = deepClone(charDefaults[missingProp]);
      return {
        path: path,
        type: "add_required",
        message: `添加 characters[${idx}] 必填字段 "${missingProp}"。`,
      };
    }
  }

  // location-level required fields
  const locIdxMatch = path.match(/locations\[(\d+)\]/);
  if (locIdxMatch) {
    const idx = Number(locIdxMatch[1]);
    const locs = script.locations as Record<string, unknown>[] ?? [];
    const loc = locs[idx] as Record<string, unknown> ?? {};
    const locDefaults: Record<string, unknown> = {
      id: `loc_${String(idx + 1).padStart(3, "0")}`,
      name: `地点${idx + 1}`,
      description: "需补充描述。",
      visual_notes: "需补充渲染氛围。",
    };
    if (missingProp && missingProp in locDefaults) {
      loc[missingProp] = deepClone(locDefaults[missingProp]);
      return {
        path: path,
        type: "add_required",
        message: `添加 locations[${idx}] 必填字段 "${missingProp}"。`,
      };
    }
  }

  // relationship-level required fields
  const relMatch = path.match(/relationships\[(\d+)\]/);
  if (relMatch && missingProp) {
    const relDefaults: Record<string, unknown> = {
      target: "",
      type: "unknown",
      description: "需补充关系描述。",
    };
    if (missingProp in relDefaults) {
      // traverse to set it
      const parts = path.replace(/^\$\.?/, "").split(/\./);
      let current: Record<string, unknown> = script;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        const arrMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrMatch) {
          current = (current[arrMatch[1]] as unknown[])[Number(arrMatch[2])] as Record<string, unknown>;
        } else if (part) {
          current = current[part] as Record<string, unknown>;
        }
      }
      current[missingProp] = relDefaults[missingProp];
      return {
        path: path,
        type: "add_required",
        message: `添加 relationship 必填字段 "${missingProp}"。`,
      };
    }
  }

  // source_chapter required fields
  const chIdxMatch = path.match(/source\.chapters\[(\d+)\]/) || path.match(/chapters\[(\d+)\]/);
  if (chIdxMatch) {
    const idx = Number(chIdxMatch[1]);
    const src = script.source as Record<string, unknown> ?? {};
    const chs = src.chapters as Record<string, unknown>[] ?? [];
    const ch = chs[idx] as Record<string, unknown> ?? {};
    const chDefaults: Record<string, unknown> = {
      id: `ch_${String(idx + 1).padStart(3, "0")}`,
      title: `第${idx + 1}章`,
      summary: "需补充摘要。",
      key_facts: [
        { id: `fact_${String(idx * 3 + 1).padStart(3, "0")}`, type: "event" satisfies SourceFactType, content: "需补充原文事件事实。" },
        { id: `fact_${String(idx * 3 + 2).padStart(3, "0")}`, type: "character_goal" satisfies SourceFactType, content: "需补充人物目标事实。" },
        { id: `fact_${String(idx * 3 + 3).padStart(3, "0")}`, type: "conflict" satisfies SourceFactType, content: "需补充冲突事实。" },
      ],
    };
    if (missingProp && missingProp in chDefaults) {
      ch[missingProp] = deepClone(chDefaults[missingProp]);
      return {
        path: path,
        type: "add_required",
        message: `添加 chapters[${idx}] 必填字段 "${missingProp}"。`,
      };
    }
  }

  return null;
}

function fixTypeError(
  script: Record<string, unknown>,
  err: ValidationError,
): AppliedFixDraft | null {
  const normalizedPath = normalizeRepairPath(err.path);
  const parts = normalizedPath.replace(/^\$\.?/, "").split(/\./);
  const fieldName = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join(".") || "$";
  const parent = parentPath === "$" ? script : getNested(script, parentPath) as Record<string, unknown>;

  if (!parent || typeof parent !== "object") return null;
  const value = (parent as Record<string, unknown>)[fieldName];

  if (value === null || value === undefined) return null;

  // Try to coerce common type mismatches
  if (typeof value === "string") {
    // String where number expected
    if (fieldName === "target_duration_minutes" || fieldName.endsWith("_count")) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        (parent as Record<string, unknown>)[fieldName] = num;
        return { path: err.path, type: "fix_type", message: `将 "${value}" 转为数字 ${num}。` };
      }
    }
    // String where array expected
    if (fieldName === "characters" || fieldName === "source_chapters" || fieldName === "source_refs" || fieldName === "main_conflicts" || fieldName === "omitted_or_compressed" || fieldName === "revision_suggestions") {
      (parent as Record<string, unknown>)[fieldName] = [value];
      return { path: err.path, type: "fix_type", message: `将字符串 "${value}" 转为数组。` };
    }
  }

  if (typeof value === "number") {
    // Number where string expected
    if (fieldName === "title" || fieldName === "name" || fieldName === "description") {
      (parent as Record<string, unknown>)[fieldName] = String(value);
      return { path: err.path, type: "fix_type", message: `将数字 ${value} 转为字符串。` };
    }
  }

  if (typeof value === "boolean") {
    (parent as Record<string, unknown>)[fieldName] = String(value);
    return { path: err.path, type: "fix_type", message: `将布尔值转为字符串。` };
  }

  // Array where object expected (e.g. scenes is an object instead of array)
  if (Array.isArray(value) && fieldName.match(/report$|metadata$|source$/)) {
    return null; // Can't auto-fix array→object
  }

  return null;
}

function fixMinItems(
  script: Record<string, unknown>,
  err: ValidationError,
): AppliedFixDraft | null {
  const path = normalizeRepairPath(err.path);
  // If array is empty, we can't auto-create content
  // For characters/locations/scenes with minItems: 1, we can add a placeholder
  if (path.endsWith("characters") || path.endsWith("locations") || path.endsWith("scenes")) {
    const arr = getNested(script, path) as unknown[];
    if (Array.isArray(arr) && arr.length === 0) {
      // Can't auto-create meaningful content for empty arrays, just flag as unfixable
      return null;
    }
  }

  // source.chapters minItems: 3
  if (path.endsWith("chapters") && path.includes("source")) {
    const arr = getNested(script, path) as unknown[];
    if (Array.isArray(arr) && arr.length > 0 && arr.length < 3) {
      // Can't auto-create chapters, leave as diagnostic
      return null;
    }
  }

  return null;
}

function fixReferenceError(
  script: Record<string, unknown>,
  err: ValidationError,
  characterIds: Set<string>,
  locationIds: Set<string>,
  chapterIds: Set<string>,
  factIds: Set<string>,
): AppliedFixDraft | null {
  const path = normalizeRepairPath(err.path);
  // scene.location reference
  const sceneLocMatch = path.match(/scenes\[(\d+)\]\.location/);
  if (sceneLocMatch) {
    const idx = Number(sceneLocMatch[1]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[idx] as Record<string, unknown> ?? {};
    const badLoc = scene.location as string;
    // Try to find closest match or use first available location
    if (locationIds.size > 0) {
      const firstLoc = [...locationIds][0];
      scene.location = firstLoc;
      return {
        path: path,
        type: "fix_reference",
        message: `场景地点 "${badLoc}" 无效，已修正为第一个可用地点 "${firstLoc}"。`,
      };
    }
    return null;
  }

  // scene.characters reference
  const sceneCharMatch = path.match(/scenes\[(\d+)\]\.characters\[(\d+)\]/);
  if (sceneCharMatch) {
    const sIdx = Number(sceneCharMatch[1]);
    const cIdx = Number(sceneCharMatch[2]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[sIdx] as Record<string, unknown> ?? {};
    const chars = scene.characters as string[] ?? [];
    const badChar = chars[cIdx];
    if (characterIds.size > 0 && badChar) {
      // Try to match by name (case-insensitive)
      const characters = script.characters as ScriptCharacter[] ?? [];
      const byName = characters.find((c) => c.name === badChar || c.name.includes(badChar) || badChar.includes(c.name));
      if (byName) {
        chars[cIdx] = byName.id;
        return {
          path: path,
          type: "fix_reference",
          message: `场景角色 "${badChar}" 不在 characters 中，已根据名称匹配为 "${byName.id}"。`,
        };
      }
      // Fall back to first character
      const firstChar = [...characterIds][0];
      chars[cIdx] = firstChar;
      return {
        path: path,
        type: "fix_reference",
        message: `场景角色 "${badChar}" 不在 characters 中，已修正为第一个角色 "${firstChar}"。`,
      };
    }
    return null;
  }

  // scene.source_chapters reference
  const scRefMatch = path.match(/scenes\[(\d+)\]\.source_chapters\[(\d+)\]/);
  if (scRefMatch) {
    const sIdx = Number(scRefMatch[1]);
    const cIdx = Number(scRefMatch[2]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[sIdx] as Record<string, unknown> ?? {};
    const srcChs = scene.source_chapters as string[] ?? [];
    const badCh = srcChs[cIdx];
    if (chapterIds.size > 0 && badCh) {
      const firstCh = [...chapterIds][0];
      srcChs[cIdx] = firstCh;
      return {
        path: path,
        type: "fix_reference",
        message: `来源章节 "${badCh}" 不在 source.chapters 中，已修正为第一个章节 "${firstCh}"。`,
      };
    }
    return null;
  }

  const sceneSourceRefMatch = path.match(/scenes\[(\d+)\]\.source_refs\[(\d+)\]/);
  if (sceneSourceRefMatch) {
    const sIdx = Number(sceneSourceRefMatch[1]);
    const rIdx = Number(sceneSourceRefMatch[2]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[sIdx] as Record<string, unknown> ?? {};
    const refs = scene.source_refs as string[] ?? [];
    const badRef = refs[rIdx];
    if (factIds.size > 0 && badRef) {
      const firstFact = [...factIds][0];
      refs[rIdx] = firstFact;
      return {
        path,
        type: "fix_reference",
        message: `场景来源事实 "${badRef}" 不存在，已改用第一条关键信息 "${firstFact}"。`,
      };
    }
    return null;
  }

  // dialogue beat.character reference
  const beatCharMatch = path.match(/scenes\[(\d+)\]\.beats\[(\d+)\]\.character/);
  if (beatCharMatch) {
    const sIdx = Number(beatCharMatch[1]);
    const bIdx = Number(beatCharMatch[2]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[sIdx] as Record<string, unknown> ?? {};
    const beats = scene.beats as ScriptBeat[] ?? [];
    const beat = beats[bIdx] as Record<string, unknown> ?? {};
    const badChar = beat.character as string;
    if (characterIds.size > 0 && badChar) {
      // Try name matching
      const characters = script.characters as ScriptCharacter[] ?? [];
      const byName = characters.find((c) => c.name === badChar || c.name.includes(badChar) || badChar.includes(c.name));
      if (byName) {
        beat.character = byName.id;
        return {
          path: path,
          type: "fix_reference",
          message: `对白角色 "${badChar}" 不在 characters 中，已根据名称匹配为 "${byName.id}"。`,
        };
      }
      const firstChar = [...characterIds][0];
      beat.character = firstChar;
      return {
        path: path,
        type: "fix_reference",
        message: `对白角色 "${badChar}" 不在 characters 中，已修正为第一个角色 "${firstChar}"。`,
      };
    }
    return null;
  }

  const beatSourceRefMatch = path.match(/scenes\[(\d+)\]\.beats\[(\d+)\]\.source_refs\[(\d+)\]/);
  if (beatSourceRefMatch) {
    const sIdx = Number(beatSourceRefMatch[1]);
    const bIdx = Number(beatSourceRefMatch[2]);
    const rIdx = Number(beatSourceRefMatch[3]);
    const scenes = script.scenes as Record<string, unknown>[] ?? [];
    const scene = scenes[sIdx] as Record<string, unknown> ?? {};
    const beats = scene.beats as Record<string, unknown>[] ?? [];
    const beat = beats[bIdx] as Record<string, unknown> ?? {};
    const refs = beat.source_refs as string[] ?? [];
    const badRef = refs[rIdx];
    if (factIds.size > 0 && badRef) {
      const firstFact = [...factIds][0];
      refs[rIdx] = firstFact;
      return {
        path,
        type: "fix_reference",
        message: `片段来源事实 "${badRef}" 不存在，已改用第一条关键信息 "${firstFact}"。`,
      };
    }
    return null;
  }

  // relationship.target reference
  const relTargetMatch = path.match(/characters\[(\d+)\]\.relationships\[(\d+)\]\.target/);
  if (relTargetMatch) {
    const cIdx = Number(relTargetMatch[1]);
    const rIdx = Number(relTargetMatch[2]);
    const chars = script.characters as Record<string, unknown>[] ?? [];
    const character = chars[cIdx] as Record<string, unknown> ?? {};
    const rels = character.relationships as Record<string, unknown>[] ?? [];
    const rel = rels[rIdx] as Record<string, unknown> ?? {};
    const badTarget = rel.target as string;
    if (characterIds.size > 0 && badTarget) {
      // Try name matching
      const characters = script.characters as ScriptCharacter[] ?? [];
      const byName = characters.find((c) => c.name === badTarget || c.name.includes(badTarget) || badTarget.includes(c.name));
      if (byName) {
        rel.target = byName.id;
        return {
          path: path,
          type: "fix_reference",
          message: `关系目标 "${badTarget}" 不在 characters 中，已根据名称匹配为 "${byName.id}"。`,
        };
      }
      const firstChar = [...characterIds].find((id) => id !== chars[cIdx]?.id) ?? [...characterIds][0];
      rel.target = firstChar;
      return {
        path: path,
        type: "fix_reference",
        message: `关系目标 "${badTarget}" 不在 characters 中，已修正为角色 "${firstChar}"。`,
      };
    }
    return null;
  }

  return null;
}

function extractMissingProperty(err: ValidationError): string | null {
  // From Ajv required error: params.missingProperty
  const msg = err.message;
  const match = msg.match(/缺少必填字段\s+"([^"]+)"/);
  if (match) return match[1];
  // Try direct from error message
  const match2 = msg.match(/"([^"]+)"$/);
  return match2?.[1] ?? null;
}
