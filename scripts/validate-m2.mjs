import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const { load: parseYaml, dump: dumpYaml } = require("js-yaml");
const scriptForgeSchema = require("../schema/scriptforge.schema.json");

const root = process.cwd();
const fixtureText = readFileSync(join(root, "src/lib/schema/fixtures.ts"), "utf8");
for (const token of ['schema_version: "1.1"', "key_facts", "scene_card", "source_refs", "function"]) {
  assert.ok(fixtureText.includes(token), `fixtures.ts must include 1.1 token: ${token}`);
}

const validDocument = {
  script: {
    schema_version: "1.1",
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
        { id: "ch_001", title: "第一章", summary: "林舟收到匿名信。", key_facts: [
          { id: "fact_001", type: "event", content: "林舟收到匿名信。" },
          { id: "fact_002", type: "character_goal", content: "林舟想查明父亲失踪真相。" },
          { id: "fact_003", type: "location", content: "匿名信指向旧报社地下室。" },
        ] },
        { id: "ch_002", title: "第二章", summary: "林舟发现档案。", key_facts: [
          { id: "fact_004", type: "event", content: "林舟进入档案室。" },
          { id: "fact_005", type: "object", content: "卷宗夹着父亲采访卡。" },
          { id: "fact_006", type: "conflict", content: "许曼阻止林舟翻查档案。" },
        ] },
        { id: "ch_003", title: "第三章", summary: "旧照片揭示关系。", key_facts: [
          { id: "fact_007", type: "information", content: "旧照片显示许曼认识林舟父亲。" },
          { id: "fact_008", type: "relationship", content: "许曼隐瞒旧关系。" },
          { id: "fact_009", type: "emotion", content: "林舟从愤怒转为戒备。" },
        ] },
      ],
    },
    characters: [
      { id: "char_001", name: "林舟", role: "protagonist", description: "年轻记者。", motivation: "查明真相。", arc: "从冲动到警觉。", voice: "短句追问。" },
      { id: "char_002", name: "许曼", role: "supporting", description: "旧报社管理员。", motivation: "守护秘密。", arc: "从拒绝到暴露破绽。", voice: "克制戒备。", relationships: [{ target: "char_001", type: "colleague", description: "互不信任。" }] },
    ],
    locations: [
      { id: "loc_001", name: "旧报社地下室", description: "昏暗潮湿。", visual_notes: "手电光、旧纸味和铁门回声。" },
    ],
    scenes: [
      {
        id: "scene_001",
        title: "铁门之后",
        source_chapters: ["ch_001", "ch_002", "ch_003"],
        source_refs: ["fact_001", "fact_004", "fact_007"],
        location: "loc_001",
        time: "night",
        characters: ["char_001", "char_002"],
        scene_card: {
          objective: "林舟想确认父亲留下的线索。",
          opposition: "许曼阻止他继续深入。",
          entry_state: "林舟带着疑问进入，许曼戒备。",
          turning_point: "旧照片证明许曼认识林舟父亲。",
          exit_state: "林舟获得新方向，许曼暴露隐瞒。",
          visual_atmosphere: "潮湿地下室里手电光和铁门回声压住对话。",
        },
        dramatic_purpose: "让主角进入核心调查地点。",
        conflict: "林舟追查真相，许曼试图阻止。",
        beats: [
          { type: "action", character: "char_001", function: "establish", source_refs: ["fact_001"], content: "林舟推开铁门，手电光扫过旧报纸。" },
          { type: "dialogue", character: "char_002", function: "evade", source_refs: ["fact_006"], content: "许曼挡在门口：你不该来这里。" },
          { type: "dialogue", character: "char_001", function: "pressure", source_refs: ["fact_002"], content: "林舟压低声音追问：那你为什么知道这封信？" },
          { type: "action", character: "char_001", function: "reveal", source_refs: ["fact_007"], content: "旧照片从卷宗里滑落，许曼的脸色变了。" },
        ],
        adaptation_notes: ["合并三章线索为一场调查对手戏。"],
      },
    ],
    adaptation_report: {
      chapter_count: 3,
      scene_count: 1,
      character_count: 2,
      main_conflicts: ["主角追查真相与管理员隐瞒之间的冲突。"],
      omitted_or_compressed: ["压缩背景说明。"],
      revision_suggestions: ["继续强化第二轮对白攻防。"],
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
  doc.script.scenes[0].source_refs = ["fact_999"];
  doc.script.scenes[0].beats[1].character = "char_999";
  doc.script.scenes[0].beats[1].source_refs = ["fact_999"];
  doc.script.characters[0].relationships = [{ target: "char_999", type: "family", description: "不存在的关系目标。" }];
  return doc;
}

function makeEmptyAdaptationReportDocument() {
  const doc = JSON.parse(JSON.stringify(validDocument));
  doc.script.adaptation_report = { chapter_count: 3, scene_count: 1, character_count: 2, main_conflicts: [], omitted_or_compressed: [], revision_suggestions: [] };
  return doc;
}

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(scriptForgeSchema);

function refError(path, message) {
  return { path, message, source: "reference", severity: "error", keyword: "reference" };
}

function runSchemaValidation(data) {
  const ok = validateSchema(data);
  if (ok) return [];
  return (validateSchema.errors ?? []).filter((e) => e.keyword !== "error").map((e) => ({
    path: "$" + (e.instancePath || ""),
    message: e.message ?? "不符合 Schema 要求。",
    source: "schema",
    severity: "error",
    keyword: e.keyword,
  }));
}

function validateReferences(script) {
  const errors = [];
  const charIds = new Set(script.characters.map((c) => c.id));
  const locIds = new Set(script.locations.map((l) => l.id));
  const chIds = new Set(script.source.chapters.map((ch) => ch.id));
  const factIds = new Set(script.source.chapters.flatMap((ch) => ch.key_facts.map((fact) => fact.id)));

  script.scenes.forEach((scene, si) => {
    if (!locIds.has(scene.location)) errors.push(refError(`$.script.scenes[${si}].location`, `场景地点 "${scene.location}" 不在 locations 中。`));
    scene.characters.forEach((cid, ci) => {
      if (!charIds.has(cid)) errors.push(refError(`$.script.scenes[${si}].characters[${ci}]`, `场景角色 "${cid}" 不在 characters 中。`));
    });
    scene.source_chapters.forEach((chid, chi) => {
      if (!chIds.has(chid)) errors.push(refError(`$.script.scenes[${si}].source_chapters[${chi}]`, `来源章节 "${chid}" 不在 source.chapters 中。`));
    });
    scene.source_refs.forEach((factId, ri) => {
      if (!factIds.has(factId)) errors.push(refError(`$.script.scenes[${si}].source_refs[${ri}]`, `场景来源事实 "${factId}" 不在 key_facts 中。`));
    });
    scene.beats.forEach((beat, bi) => {
      if (beat.type === "dialogue" && beat.character && !charIds.has(beat.character)) errors.push(refError(`$.script.scenes[${si}].beats[${bi}].character`, `对白角色 "${beat.character}" 不在 characters 中。`));
      beat.source_refs.forEach((factId, ri) => {
        if (!factIds.has(factId)) errors.push(refError(`$.script.scenes[${si}].beats[${bi}].source_refs[${ri}]`, `beat 来源事实 "${factId}" 不在 key_facts 中。`));
      });
    });
  });

  script.characters.forEach((ch, ci) => {
    if (!ch.relationships) return;
    ch.relationships.forEach((rel, ri) => {
      if (!charIds.has(rel.target)) errors.push(refError(`$.script.characters[${ci}].relationships[${ri}].target`, `关系目标 "${rel.target}" 不在 characters 中。`));
    });
  });
  return errors;
}

function validateAdaptationCompleteness(report) {
  const warnings = [];
  if (!report.main_conflicts?.length) warnings.push({ path: "$.script.adaptation_report.main_conflicts", message: "改编报告缺少 main_conflicts。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.omitted_or_compressed?.length) warnings.push({ path: "$.script.adaptation_report.omitted_or_compressed", message: "改编报告缺少 omitted_or_compressed。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.revision_suggestions?.length) warnings.push({ path: "$.script.adaptation_report.revision_suggestions", message: "改编报告缺少 revision_suggestions。", source: "reference", severity: "warning", keyword: "completeness" });
  return warnings;
}

function validateDocument(data) {
  const schemaErrors = runSchemaValidation(data);
  if (schemaErrors.length > 0) return { valid: false, status: "error", errors: schemaErrors, warnings: [], lastValidCandidate: null };
  const refErrors = validateReferences(data.script);
  const adaptWarnings = validateAdaptationCompleteness(data.script.adaptation_report);
  const allErrors = refErrors.filter((e) => e.severity === "error");
  const allWarnings = [...refErrors.filter((e) => e.severity === "warning"), ...adaptWarnings];
  return { valid: allErrors.length === 0, status: allErrors.length > 0 ? "error" : allWarnings.length > 0 ? "warn" : "pass", errors: allErrors, warnings: allWarnings, lastValidCandidate: allErrors.length === 0 ? data : null };
}

function validateYaml(yamlText) {
  let parsed;
  try {
    parsed = parseYaml(yamlText);
  } catch (err) {
    return { valid: false, status: "error", errors: [{ path: "$", message: `YAML 解析失败：${err.message}`, source: "yaml", severity: "error", keyword: "parse" }], warnings: [], lastValidCandidate: null };
  }
  if (parsed === null || parsed === undefined) return { valid: false, status: "error", errors: [{ path: "$", message: "YAML 内容为空。", source: "yaml", severity: "error", keyword: "parse" }], warnings: [], lastValidCandidate: null };
  return validateDocument(parsed);
}

const r1 = validateDocument(validDocument);
assert.equal(r1.valid, true, "完整 1.1 示例剧本 JSON 应通过 M2 校验");
assert.equal(r1.status, "pass");
console.log("✓ Test 1: Valid 1.1 document passes");

const r2 = validateYaml(dumpYaml(validDocument));
assert.equal(r2.valid, true, "完整 1.1 示例剧本 YAML 应通过 M2 校验");
console.log("✓ Test 2: Valid 1.1 document YAML passes");

const r3 = validateDocument(makeMissingFieldDocument());
assert.equal(r3.valid, false);
assert.ok(r3.errors.some((e) => e.message.includes("title") || e.path.includes("title")));
console.log("✓ Test 3: Missing required field fails with path");

const r4 = validateDocument(makeBrokenReferenceDocument());
assert.equal(r4.valid, false);
assert.deepEqual(r4.errors.map((e) => e.path).sort(), [
  "$.script.characters[0].relationships[0].target",
  "$.script.scenes[0].beats[1].character",
  "$.script.scenes[0].beats[1].source_refs[0]",
  "$.script.scenes[0].characters[1]",
  "$.script.scenes[0].location",
  "$.script.scenes[0].source_chapters[0]",
  "$.script.scenes[0].source_refs[0]",
]);
console.log("✓ Test 4: Broken 1.1 references fail with correct paths");

const r5 = validateDocument(makeEmptyAdaptationReportDocument());
assert.equal(r5.status, "warn");
assert.equal(r5.valid, true);
assert.ok(r5.warnings.length >= 3);
console.log("✓ Test 5: Empty adaptation report gives warnings");

assert.equal(validateYaml("{invalid: yaml: [").valid, false);
console.log("✓ Test 6: Invalid YAML returns parse error");

assert.equal(validateYaml("---\n").valid, false);
console.log("✓ Test 7: Empty YAML returns error");

const r8 = validateDocument(validDocument);
assert.ok("valid" in r8 && "status" in r8 && "errors" in r8 && "warnings" in r8 && "lastValidCandidate" in r8);
console.log("✓ Test 8: ValidationResult structure complete");

console.log("\n═══════════════════════════════════════════");
console.log("  M2 Schema Validation — All tests passed");
console.log("═══════════════════════════════════════════");
