import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const { load: parseYaml, dump: dumpYaml } = require("js-yaml");
const scriptForgeSchema = require("../schema/scriptforge.schema.json");

// ── Fixtures inlined (mirrors src/lib/schema/fixtures.ts) ─────────────────

const validDocument = {
  script: {
    schema_version: "1.0",
    title: "雨夜档案",
    metadata: {
      language: "zh-CN",
      format: "short_drama",
      genre: "悬疑",
      target_duration_minutes: 12,
      logline: "年轻记者追查父亲失踪真相，却发现旧报社隐藏着更深的秘密。",
      tone: "紧张、克制、现实主义",
    },
    source: {
      type: "novel",
      chapters: [
        { id: "ch_001", title: "第一章 雨夜", summary: "林舟收到父亲留下的匿名信，前往旧报社。" },
        { id: "ch_002", title: "第二章 档案室", summary: "林舟在地下档案室发现失踪案卷宗。" },
        { id: "ch_003", title: "第三章 旧照片", summary: "一张旧照片揭示管理员与父亲曾经相识。" },
      ],
    },
    characters: [
      {
        id: "char_001", name: "林舟", role: "protagonist",
        description: "年轻记者，执着但冲动。", motivation: "查明父亲失踪真相。",
        arc: "从单打独斗到开始信任他人。", voice: "短句多，追问直接。",
      },
      {
        id: "char_002", name: "许曼", role: "supporting",
        description: "旧报社管理员，沉默寡言。", motivation: "守护报社秘密。",
        arc: "从拒绝到被迫合作。", voice: "言简意赅，带有戒备。",
        relationships: [{ target: "char_001", type: "colleague", description: "工作关系，互不信任。" }],
      },
    ],
    locations: [
      { id: "loc_001", name: "旧报社地下室", description: "昏暗、潮湿，墙上贴满旧报纸。", visual_notes: "手电光、低照度、狭窄空间。" },
    ],
    scenes: [
      {
        id: "scene_001", title: "铁门之后",
        source_chapters: ["ch_001"], location: "loc_001", time: "night",
        characters: ["char_001", "char_002"],
        dramatic_purpose: "让主角进入核心调查地点。",
        conflict: "主角害怕未知，但必须继续追查；管理员试图阻止他继续深入。",
        beats: [
          { type: "action", content: "林舟推开地下室铁门，潮气扑面而来。" },
          { type: "dialogue", character: "char_002", content: "你父亲如果真想让你来，就不会只留一封没有署名的信。" },
          { type: "narration", content: "他终于来到父亲信中提到的地方。" },
        ],
      },
    ],
    adaptation_report: {
      chapter_count: 3, scene_count: 1, character_count: 2,
      main_conflicts: ["主角追查真相与未知危险之间的冲突。"],
      omitted_or_compressed: ["压缩了原文中较长的环境描写。"],
      revision_suggestions: ["建议增加与管理员的对手戏。"],
    },
  },
};

function makeMissingFieldDocument() {
  const doc = JSON.parse(JSON.stringify(validDocument));
  delete doc.script.title;
  return doc;
}

function makeBrokenReferenceDocument() {
  const doc = JSON.parse(JSON.stringify(validDocument));
  doc.script.scenes[0].location = "loc_999";
  doc.script.scenes[0].characters = ["char_001", "char_999"];
  doc.script.scenes[0].source_chapters = ["ch_999"];
  doc.script.characters[0].relationships = [
    { target: "char_999", type: "family", description: "不存在的关系目标。" },
  ];
  const db = doc.script.scenes[0].beats.find(b => b.type === "dialogue");
  if (db) db.character = "char_999";
  return doc;
}

function makeEmptyAdaptationReportDocument() {
  const doc = JSON.parse(JSON.stringify(validDocument));
  doc.script.adaptation_report = {
    chapter_count: 3, scene_count: 1, character_count: 2,
    main_conflicts: [], omitted_or_compressed: [], revision_suggestions: [],
  };
  return doc;
}

// ── Ajv validation ────────────────────────────────────────────────────────

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(scriptForgeSchema);

function refError(path, message) {
  return { path, message, source: "reference", severity: "error", keyword: "reference" };
}

function runSchemaValidation(data) {
  const ok = validateSchema(data);
  if (ok) return [];
  return (validateSchema.errors ?? [])
    .filter(e => e.keyword !== "error")
    .map(e => ({
      path: "$" + (e.instancePath || ""),
      message: formatAjvError(e, "$" + (e.instancePath || "")),
      source: "schema",
      severity: "error",
      keyword: e.keyword,
    }));
}

function formatAjvError(error, path) {
  switch (error.keyword) {
    case "required": return `${path} 缺少必填字段 ${JSON.stringify(error.params.missingProperty)}。`;
    case "additionalProperties": return `${path} 包含 Schema 不允许的字段。`;
    case "minItems": return `${path} 至少需要 ${String(error.params.limit)} 项。`;
    case "minLength": return `${path} 不能为空。`;
    case "enum": return `${path} 必须是允许值之一。`;
    case "type": return `${path} 类型应为 ${String(error.params.type)}。`;
    case "const": return `${path} 必须等于 ${JSON.stringify(error.params.allowedValue)}。`;
    case "minimum": return `${path} 不能小于 ${String(error.params.limit)}。`;
    default: return `${path} ${error.message ?? "不符合 Schema 要求。"}`;
  }
}

function validateReferences(script) {
  const errors = [];
  const charIds = new Set(script.characters.map(c => c.id));
  const locIds = new Set(script.locations.map(l => l.id));
  const chIds = new Set(script.source.chapters.map(ch => ch.id));

  script.scenes.forEach((scene, si) => {
    if (!locIds.has(scene.location))
      errors.push(refError(`$.script.scenes[${si}].location`, `场景地点 "${scene.location}" 不在 locations 中。`));
    scene.characters.forEach((cid, ci) => {
      if (!charIds.has(cid))
        errors.push(refError(`$.script.scenes[${si}].characters[${ci}]`, `场景角色 "${cid}" 不在 characters 中。`));
    });
    scene.source_chapters.forEach((chid, chi) => {
      if (!chIds.has(chid))
        errors.push(refError(`$.script.scenes[${si}].source_chapters[${chi}]`, `来源章节 "${chid}" 不在 source.chapters 中。`));
    });
    scene.beats.forEach((beat, bi) => {
      if (beat.type === "dialogue" && beat.character && !charIds.has(beat.character))
        errors.push(refError(`$.script.scenes[${si}].beats[${bi}].character`, `对白角色 "${beat.character}" 不在 characters 中。`));
    });
  });

  script.characters.forEach((ch, ci) => {
    if (!ch.relationships) return;
    ch.relationships.forEach((rel, ri) => {
      if (!charIds.has(rel.target))
        errors.push(refError(`$.script.characters[${ci}].relationships[${ri}].target`, `关系目标 "${rel.target}" 不在 characters 中。`));
    });
  });

  return errors;
}

function validateAdaptationCompleteness(report) {
  const warnings = [];
  if (!report.main_conflicts || report.main_conflicts.length === 0)
    warnings.push({ path: "$.script.adaptation_report.main_conflicts", message: "改编报告缺少 main_conflicts，建议至少说明一个核心冲突。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.omitted_or_compressed || report.omitted_or_compressed.length === 0)
    warnings.push({ path: "$.script.adaptation_report.omitted_or_compressed", message: "改编报告缺少 omitted_or_compressed，建议说明省略或压缩的内容。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.revision_suggestions || report.revision_suggestions.length === 0)
    warnings.push({ path: "$.script.adaptation_report.revision_suggestions", message: "改编报告缺少 revision_suggestions，建议至少提供一条修改建议。", source: "reference", severity: "warning", keyword: "completeness" });
  return warnings;
}

function validateDocument(data) {
  const schemaErrors = runSchemaValidation(data);
  if (schemaErrors.length > 0) {
    const hasErrors = schemaErrors.some(e => e.severity === "error");
    return { valid: false, status: hasErrors ? "error" : "warn", errors: schemaErrors.filter(e => e.severity === "error"), warnings: schemaErrors.filter(e => e.severity === "warning"), lastValidCandidate: null };
  }
  const doc = data;
  const refErrors = validateReferences(doc.script);
  const adaptWarnings = validateAdaptationCompleteness(doc.script.adaptation_report);
  const allErrors = refErrors.filter(e => e.severity === "error");
  const allWarnings = [...refErrors.filter(e => e.severity === "warning"), ...adaptWarnings];
  const status = allErrors.length > 0 ? "error" : allWarnings.length > 0 ? "warn" : "pass";
  return { valid: allErrors.length === 0, status, errors: allErrors, warnings: allWarnings, lastValidCandidate: allErrors.length === 0 ? doc : null };
}

function validateYaml(yamlText) {
  let parsed;
  try { parsed = parseYaml(yamlText); } catch (err) {
    return { valid: false, status: "error", errors: [{ path: "$", message: `YAML 解析失败：${err.message}`, source: "yaml", severity: "error", keyword: "parse" }], warnings: [], lastValidCandidate: null };
  }
  if (parsed === null || parsed === undefined)
    return { valid: false, status: "error", errors: [{ path: "$", message: "YAML 内容为空。", source: "yaml", severity: "error", keyword: "parse" }], warnings: [], lastValidCandidate: null };
  return validateDocument(parsed);
}

// ── Tests ─────────────────────────────────────────────────────────────────

const r1 = validateDocument(validDocument);
assert.equal(r1.valid, true, "完整示例剧本 JSON 应通过 M2 校验");
assert.equal(r1.status, "pass");
assert.equal(r1.errors.length, 0);
assert.notEqual(r1.lastValidCandidate, null);
console.log("✓ Test 1: Valid document passes");

const r2 = validateYaml(dumpYaml(validDocument));
assert.equal(r2.valid, true, "完整示例剧本 YAML 应通过 M2 校验");
assert.equal(r2.status, "pass");
console.log("✓ Test 2: Valid document YAML passes");

const r3 = validateDocument(makeMissingFieldDocument());
assert.equal(r3.valid, false, "删除必填字段后必须校验失败");
assert.equal(r3.status, "error");
assert.ok(
  r3.errors.some(e => e.path.includes("script") && e.message.includes("title")),
  `错误应定位到 title: ${JSON.stringify(r3.errors)}`,
);
assert.equal(r3.lastValidCandidate, null);
console.log("✓ Test 3: Missing required field fails with path");

const r4 = validateDocument(makeBrokenReferenceDocument());
assert.equal(r4.valid, false, "跨引用错误必须校验失败");
assert.equal(r4.status, "error");
const ep4 = r4.errors.map(e => e.path).sort();
const epExpected = [
  "$.script.characters[0].relationships[0].target",
  "$.script.scenes[0].beats[1].character",
  "$.script.scenes[0].characters[1]",
  "$.script.scenes[0].location",
  "$.script.scenes[0].source_chapters[0]",
];
assert.deepEqual(ep4, epExpected, "跨引用错误应定位到所有坏引用字段");
console.log("✓ Test 4: Broken references fail with correct paths");

const r5 = validateDocument(makeEmptyAdaptationReportDocument());
assert.equal(r5.status, "warn", "空改编报告应返回 warn");
assert.equal(r5.valid, true);
assert.ok(r5.warnings.length >= 3);
console.log("✓ Test 5: Empty adaptation report gives warnings");

const r6 = validateYaml("{invalid: yaml: [");
assert.equal(r6.valid, false);
assert.equal(r6.errors[0].source, "yaml");
console.log("✓ Test 6: Invalid YAML returns parse error");

const r7 = validateYaml("---\n");
assert.equal(r7.valid, false);
console.log("✓ Test 7: Empty YAML returns error");

const r8 = validateDocument(validDocument);
assert.ok("valid" in r8 && "status" in r8 && "errors" in r8 && "warnings" in r8 && "lastValidCandidate" in r8);
assert.ok(["pass", "warn", "error"].includes(r8.status));
console.log("✓ Test 8: ValidationResult structure complete");

console.log("\n═══════════════════════════════════════════");
console.log("  M2 Schema Validation — All tests passed");
console.log("═══════════════════════════════════════════");
