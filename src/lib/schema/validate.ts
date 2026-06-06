import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { load as parseYaml } from "js-yaml";
import scriptForgeSchema from "../../../schema/scriptforge.schema.json";
import type {
  ScriptForgeDocument,
  ScriptForgeScript,
} from "@/types/scriptforge";
import type {
  ValidationError,
  ValidationResult,
  ValidationStatus,
} from "./types";

// ── Ajv setup ──────────────────────────────────────────────────────────────

const ajv = new Ajv2020({
  allErrors: true,
  allowUnionTypes: true,
  strict: false,
});

addFormats(ajv);

const validateSchema = ajv.compile(scriptForgeSchema);

// ── Public API ─────────────────────────────────────────────────────────────

/** Validate a JSON object against the ScriptForge schema + reference checks. */
export function validateScriptForgeDocument(
  data: unknown,
): ValidationResult {
  const schemaErrors = runSchemaValidation(data);
  if (schemaErrors.length > 0) {
    const hasErrors = schemaErrors.some((e) => e.severity === "error");
    return {
      valid: false,
      status: hasErrors ? "error" : "warn",
      errors: schemaErrors.filter((e) => e.severity === "error"),
      warnings: schemaErrors.filter((e) => e.severity === "warning"),
      lastValidCandidate: null,
    };
  }

  const document = data as ScriptForgeDocument;
  const refErrors = validateScriptForgeReferences(document.script);
  const adaptWarnings = validateAdaptationCompleteness(document.script.adaptation_report);

  const allErrors = [...refErrors.filter((e) => e.severity === "error")];
  const allWarnings = [
    ...refErrors.filter((e) => e.severity === "warning"),
    ...adaptWarnings,
  ];

  const status: ValidationStatus =
    allErrors.length > 0 ? "error" : allWarnings.length > 0 ? "warn" : "pass";

  return {
    valid: allErrors.length === 0,
    status,
    errors: allErrors,
    warnings: allWarnings,
    lastValidCandidate: allErrors.length === 0 ? document : null,
  };
}

/** Validate a YAML text string: parse → validate. */
export function validateScriptForgeYaml(yamlText: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      status: "error",
      errors: [
        {
          path: "$",
          message: `YAML 解析失败：${message}`,
          source: "yaml",
          severity: "error",
          keyword: "parse",
        },
      ],
      warnings: [],
      lastValidCandidate: null,
    };
  }

  if (parsed === null || parsed === undefined) {
    return {
      valid: false,
      status: "error",
      errors: [
        {
          path: "$",
          message: "YAML 内容为空。",
          source: "yaml",
          severity: "error",
          keyword: "parse",
        },
      ],
      warnings: [],
      lastValidCandidate: null,
    };
  }

  return validateScriptForgeDocument(parsed);
}

// ── Schema validation ──────────────────────────────────────────────────────

function runSchemaValidation(data: unknown): ValidationError[] {
  const ok = validateSchema(data);
  if (ok) return [];
  return normalizeAjvErrors(validateSchema.errors ?? []);
}

// ── Reference validation ───────────────────────────────────────────────────

export function validateScriptForgeReferences(
  script: ScriptForgeScript,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const characterIds = new Set(script.characters.map((c) => c.id));
  const locationIds = new Set(script.locations.map((l) => l.id));
  const chapterIds = new Set(script.source.chapters.map((ch) => ch.id));

  // scene.location must exist in locations
  for (const [si, scene] of script.scenes.entries()) {
    if (!locationIds.has(scene.location)) {
      errors.push(
        referenceError(
          `$.script.scenes[${si}].location`,
          `场景地点 "${scene.location}" 不在 locations 中。`,
        ),
      );
    }
  }

  // scene.characters must exist in characters
  for (const [si, scene] of script.scenes.entries()) {
    for (const [ci, charId] of scene.characters.entries()) {
      if (!characterIds.has(charId)) {
        errors.push(
          referenceError(
            `$.script.scenes[${si}].characters[${ci}]`,
            `场景角色 "${charId}" 不在 characters 中。`,
          ),
        );
      }
    }
  }

  // scene.source_chapters must exist in source.chapters
  for (const [si, scene] of script.scenes.entries()) {
    for (const [chi, chId] of scene.source_chapters.entries()) {
      if (!chapterIds.has(chId)) {
        errors.push(
          referenceError(
            `$.script.scenes[${si}].source_chapters[${chi}]`,
            `来源章节 "${chId}" 不在 source.chapters 中。`,
          ),
        );
      }
    }
  }

  // dialogue beat.character must exist in characters
  for (const [si, scene] of script.scenes.entries()) {
    for (const [bi, beat] of scene.beats.entries()) {
      if (beat.type === "dialogue" && beat.character) {
        if (!characterIds.has(beat.character)) {
          errors.push(
            referenceError(
              `$.script.scenes[${si}].beats[${bi}].character`,
              `对白角色 "${beat.character}" 不在 characters 中。`,
            ),
          );
        }
      }
    }
  }

  // character.relationships[].target must exist in characters
  for (const [ci, character] of script.characters.entries()) {
    if (!character.relationships) continue;
    for (const [ri, rel] of character.relationships.entries()) {
      if (!characterIds.has(rel.target)) {
        errors.push(
          referenceError(
            `$.script.characters[${ci}].relationships[${ri}].target`,
            `关系目标 "${rel.target}" 不在 characters 中。`,
          ),
        );
      }
    }
  }

  return errors;
}

// ── Adaptation report completeness ─────────────────────────────────────────

function validateAdaptationCompleteness(
  report: ScriptForgeScript["adaptation_report"],
): ValidationError[] {
  const warnings: ValidationError[] = [];

  if (!report.main_conflicts || report.main_conflicts.length === 0) {
    warnings.push({
      path: "$.script.adaptation_report.main_conflicts",
      message: "改编报告缺少 main_conflicts，建议至少说明一个核心冲突。",
      source: "reference",
      severity: "warning",
      keyword: "completeness",
    });
  }

  if (!report.omitted_or_compressed || report.omitted_or_compressed.length === 0) {
    warnings.push({
      path: "$.script.adaptation_report.omitted_or_compressed",
      message: "改编报告缺少 omitted_or_compressed，建议说明省略或压缩的内容。",
      source: "reference",
      severity: "warning",
      keyword: "completeness",
    });
  }

  if (!report.revision_suggestions || report.revision_suggestions.length === 0) {
    warnings.push({
      path: "$.script.adaptation_report.revision_suggestions",
      message: "改编报告缺少 revision_suggestions，建议至少提供一条后续修改建议。",
      source: "reference",
      severity: "warning",
      keyword: "completeness",
    });
  }

  return warnings;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeAjvErrors(ajvErrors: ErrorObject[]): ValidationError[] {
  return ajvErrors
    .filter((err) => err.keyword !== "error")
    .map((err) => {
      const path = "$" + (err.instancePath || "");
      const message = formatAjvError(err, path);
      return {
        path,
        message,
        source: "schema" as const,
        severity: "error" as const,
        keyword: err.keyword,
      };
    });
}

function formatAjvError(error: ErrorObject, path: string): string {
  switch (error.keyword) {
    case "required":
      return `${path} 缺少必填字段 ${JSON.stringify(error.params.missingProperty)}。`;
    case "additionalProperties":
      if ("additionalProperty" in error.params) {
        return `${path}.${String(error.params.additionalProperty)} 不是 Schema 允许的字段。`;
      }
      return `${path} 包含 Schema 不允许的字段。`;
    case "minItems":
      return `${path} 至少需要 ${String(error.params.limit)} 项。`;
    case "minLength":
      return `${path} 不能为空。`;
    case "enum":
      return `${path} 必须是允许值之一。`;
    case "type":
      return `${path} 类型应为 ${String(error.params.type)}。`;
    case "const":
      return `${path} 必须等于 ${JSON.stringify(error.params.allowedValue)}。`;
    case "minimum":
      return `${path} 不能小于 ${String(error.params.limit)}。`;
    default:
      return `${path} ${error.message ?? "不符合 Schema 要求。"}`;
  }
}

function referenceError(path: string, message: string): ValidationError {
  return { path, message, source: "reference", severity: "error", keyword: "reference" };
}
