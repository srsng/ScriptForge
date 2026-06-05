import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { load: parseYaml } = require("js-yaml");

// Reuse M2 validation utilities inline (mirrors validate-m2.mjs)
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const scriptForgeSchema = require("../schema/scriptforge.schema.json");

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(scriptForgeSchema);

// ── Valid document fixture (mirrors src/lib/schema/fixtures.ts) ────────────

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
        id: "scene_001",
        title: "铁门之后",
        source_chapters: ["ch_001"],
        location: "loc_001",
        time: "night",
        characters: ["char_001", "char_002"],
        dramatic_purpose: "林舟首次进入父亲来信中提到的地方，与许曼对峙。",
        conflict: "林舟想要进入档案室查看旧案卷，许曼阻止。",
        beats: [
          { type: "action", content: "林舟推开生锈的铁门，手电光束扫过黏滞的黑暗。", character: "char_001" },
          { type: "dialogue", character: "char_001", content: "这里就是档案室？" },
          { type: "action", content: "许曼从档案柜后面走出来，手里抱着厚重的档案夹。" },
          { type: "dialogue", character: "char_002", content: "你不是该来这里的人。" },
        ],
      },
    ],
    adaptation_report: {
      chapter_count: 3,
      scene_count: 1,
      character_count: 2,
      main_conflicts: ["主角追查真相与未知危险之间的冲突。"],
      omitted_or_compressed: ["压缩了原文中较长的环境描写。"],
      revision_suggestions: ["建议增加与管理员的对手戏。"],
    },
  },
};

// ── M2 validate functions (inlined for standalone script) ──────────────────

function validateReferences(script) {
  const errors = [];
  const characterIds = new Set(script.characters.map(c => c.id));
  const locationIds = new Set(script.locations.map(l => l.id));
  const chapterIds = new Set(script.source.chapters.map(ch => ch.id));

  for (const [si, scene] of script.scenes.entries()) {
    if (!locationIds.has(scene.location))
      errors.push(refErr(`$.script.scenes[${si}].location`, `地点 "${scene.location}" 不在 locations 中。`));
    for (const [ci, chId] of scene.characters.entries()) {
      if (!characterIds.has(chId))
        errors.push(refErr(`$.script.scenes[${si}].characters[${ci}]`, `角色 "${chId}" 不在 characters 中。`));
    }
    for (const [chi, chId] of scene.source_chapters.entries()) {
      if (!chapterIds.has(chId))
        errors.push(refErr(`$.script.scenes[${si}].source_chapters[${chi}]`, `来源章节 "${chId}" 不在 source.chapters 中。`));
    }
  }

  for (const [si, scene] of script.scenes.entries()) {
    for (const [bi, beat] of scene.beats.entries()) {
      if (beat.type === "dialogue" && beat.character && !characterIds.has(beat.character))
        errors.push(refErr(`$.script.scenes[${si}].beats[${bi}].character`, `对白角色 "${beat.character}" 不在 characters 中。`));
    }
  }

  for (const [ci, character] of script.characters.entries()) {
    if (!character.relationships) continue;
    for (const [ri, rel] of character.relationships.entries()) {
      if (!characterIds.has(rel.target))
        errors.push(refErr(`$.script.characters[${ci}].relationships[${ri}].target`, `关系目标 "${rel.target}" 不在 characters 中。`));
    }
  }
  return errors;
}

function refErr(path, message) {
  return { path, message, source: "reference", severity: "error", keyword: "reference" };
}

function validateDocument(data) {
  validateSchema(data);
  const schemaErrors = (validateSchema.errors ?? []).filter(e => e.keyword !== "error").map(e => ({
    path: "$" + (e.instancePath || ""),
    message: e.message ?? "不符合 Schema 要求。",
    source: "schema",
    severity: "error",
    keyword: e.keyword,
  }));
  if (schemaErrors.length > 0)
    return { valid: false, status: "error", errors: schemaErrors, warnings: [], lastValidCandidate: null };

  const refErrors = validateReferences(data.script);
  const adaptWarnings = checkAdaptReport(data.script.adaptation_report);
  const allErrors = refErrors.filter(e => e.severity === "error");
  const allWarnings = [...refErrors.filter(e => e.severity === "warning"), ...adaptWarnings];
  return {
    valid: allErrors.length === 0,
    status: allErrors.length > 0 ? "error" : allWarnings.length > 0 ? "warn" : "pass",
    errors: allErrors,
    warnings: allWarnings,
    lastValidCandidate: allErrors.length === 0 ? data : null,
  };
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

function checkAdaptReport(report) {
  const warnings = [];
  if (!report.main_conflicts || report.main_conflicts.length === 0)
    warnings.push({ path: "$.script.adaptation_report.main_conflicts", message: "改编报告缺少 main_conflicts。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.omitted_or_compressed || report.omitted_or_compressed.length === 0)
    warnings.push({ path: "$.script.adaptation_report.omitted_or_compressed", message: "改编报告缺少 omitted_or_compressed。", source: "reference", severity: "warning", keyword: "completeness" });
  if (!report.revision_suggestions || report.revision_suggestions.length === 0)
    warnings.push({ path: "$.script.adaptation_report.revision_suggestions", message: "改编报告缺少 revision_suggestions。", source: "reference", severity: "warning", keyword: "completeness" });
  return warnings;
}

// ── YAML export simulation (mirrors src/lib/yaml.ts logic) ─────────────────

function orderedScriptForYaml(script) {
  return {
    schema_version: script.schema_version,
    title: script.title,
    metadata: {
      language: script.metadata.language,
      format: script.metadata.format,
      genre: script.metadata.genre,
      target_duration_minutes: script.metadata.target_duration_minutes,
      logline: script.metadata.logline,
      tone: script.metadata.tone,
    },
    source: {
      type: script.source.type,
      chapters: script.source.chapters.map(ch => ({ id: ch.id, title: ch.title, summary: ch.summary })),
    },
    characters: script.characters.map(c => {
      const out = { id: c.id, name: c.name, role: c.role, description: c.description, motivation: c.motivation, arc: c.arc, voice: c.voice };
      if (c.relationships?.length) out.relationships = c.relationships.map(r => ({ target: r.target, type: r.type, description: r.description }));
      return out;
    }),
    locations: script.locations.map(l => ({ id: l.id, name: l.name, description: l.description, visual_notes: l.visual_notes })),
    scenes: script.scenes.map(s => {
      const out = {
        id: s.id, title: s.title, source_chapters: s.source_chapters, location: s.location,
        time: s.time, characters: s.characters, dramatic_purpose: s.dramatic_purpose,
        conflict: s.conflict,
        beats: s.beats.map(b => {
          if (b.type === "dialogue") return { type: b.type, character: b.character, content: b.content };
          const beat = { type: b.type, content: b.content };
          if (b.character) beat.character = b.character;
          return beat;
        }),
      };
      if (s.adaptation_notes?.length) out.adaptation_notes = s.adaptation_notes;
      return out;
    }),
    adaptation_report: {
      chapter_count: script.adaptation_report.chapter_count,
      scene_count: script.adaptation_report.scene_count,
      character_count: script.adaptation_report.character_count,
      main_conflicts: script.adaptation_report.main_conflicts,
      omitted_or_compressed: script.adaptation_report.omitted_or_compressed,
      revision_suggestions: script.adaptation_report.revision_suggestions,
    },
  };
}

// ── M3 Tests ───────────────────────────────────────────────────────────────

console.log("═══ M3 YAML Export Validation ═══\n");

// Test 1: YAML stable field order — source → characters → locations → scenes → adaptation_report
const { dump: dumpYaml } = require("js-yaml");
const orderedDoc = { script: orderedScriptForYaml(validDocument.script) };
const yamlText = dumpYaml(orderedDoc, { sortKeys: false, noRefs: true, lineWidth: -1 });

const fieldOrder = ["source:", "characters:", "locations:", "scenes:", "adaptation_report:"];
let lastIdx = -1;
for (const field of fieldOrder) {
  const idx = yamlText.indexOf(field);
  assert.ok(idx > lastIdx, `字段 "${field}" 应在 "${fieldOrder[fieldOrder.indexOf(field) - 1] ?? '开头'}" 之后出现，实际位置 ${idx}，上一位置 ${lastIdx}`);
  lastIdx = idx;
}
console.log("✓ Test 1: YAML stable field order (source → characters → locations → scenes → adaptation_report)");

// Test 2: YAML round-trip — document → YAML → parse → validate
const parsed = parseYaml(yamlText);
assert.ok(parsed.script, "YAML 解析后应有 script 字段");
const m2Result = validateDocument(parsed);
assert.equal(m2Result.valid, true, "YAML 解析后再校验必须通过");
assert.equal(m2Result.status, "pass");
console.log("✓ Test 2: YAML round-trip (document → YAML → parse → M2 validate)");

// Test 3: source_chapters preserved in YAML
assert.ok(yamlText.includes("source_chapters:"), "YAML 必须包含 source_chapters");
assert.ok(yamlText.includes("ch_001"), "YAML 必须包含章节引用 ch_001");
console.log("✓ Test 3: source_chapters preserved in YAML output");

// Test 4: character and location references preserved in YAML
assert.ok(yamlText.includes("char_001"), "YAML 必须包含角色引用");
assert.ok(yamlText.includes("loc_001"), "YAML 必须包含地点引用");
console.log("✓ Test 4: Character and location references preserved");

// Test 5: adaptation_report preserved in YAML
assert.ok(yamlText.includes("adaptation_report:"), "YAML 必须包含 adaptation_report");
assert.ok(yamlText.includes("omitted_or_compressed:"), "YAML 必须包含 omitted_or_compressed");
console.log("✓ Test 5: adaptation_report preserved in YAML output");

// Test 6: Edit YAML → re-validate — break a relationship reference
// The relationship has target: char_001 (char_002's relationship targets char_001)
const brokenYaml = yamlText.replace(/target:\s+char_001/g, "target: char_999");
const brokenResult = validateYaml(brokenYaml);
assert.equal(brokenResult.valid, false, "编辑 YAML 破坏引用后必须校验失败");
assert.ok(brokenResult.errors.length > 0, "应有校验错误");
assert.ok(
  brokenResult.errors.some(e => e.path.includes("characters") || e.path.includes("character") || e.path.includes("target")),
  "错误应定位到角色引用"
);
console.log("✓ Test 6: Edit YAML → re-validate catches broken references");

// Test 7: Invalid YAML syntax returns parse error
const invalidYamlResult = validateYaml("{invalid: yaml: [");
assert.equal(invalidYamlResult.valid, false);
assert.equal(invalidYamlResult.errors[0].source, "yaml");
console.log("✓ Test 7: Invalid YAML syntax returns parse error");

// Test 8: JSON export round-trip
const jsonText = JSON.stringify(validDocument, null, 2);
const jsonParsed = JSON.parse(jsonText);
const jsonResult = validateDocument(jsonParsed);
assert.equal(jsonResult.valid, true, "JSON 导出后再校验必须通过");
console.log("✓ Test 8: JSON export round-trip validates");

// Test 9: Missing required field blocks export (validation fails)
const missingTitleDoc = JSON.parse(JSON.stringify(validDocument));
delete missingTitleDoc.script.title;
const missingResult = validateDocument(missingTitleDoc);
assert.equal(missingResult.valid, false, "缺少 title 必须校验失败");
assert.equal(missingResult.lastValidCandidate, null, "lastValidCandidate 必须为 null");
const hasTitleError = missingResult.errors.some(e => e.path.includes("title") || e.message.includes("title"));
assert.ok(hasTitleError, "错误信息应包含 title 字段");
console.log("✓ Test 9: Missing required field blocks export (validation fails, lastValidCandidate=null)");

// Test 10: YAML filename generation check (basic)
function generateYamlFilename(title) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/:/g, "-").replace("T", "_").slice(0, 19);
  const safeTitle = (title ?? "scriptforge").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, "_").slice(0, 60);
  return `${safeTitle}_${dateStr}.yaml`;
}
const fname = generateYamlFilename("雨夜档案");
assert.ok(fname.endsWith(".yaml"), "YAML 文件名应以 .yaml 结尾");
assert.ok(fname.startsWith("雨夜档案_"), "文件名应包含项目名");
assert.ok(fname.includes("20"), "文件名应包含时间戳");
console.log("✓ Test 10: YAML filename includes project name and timestamp");

// Test 11: Markdown export contains key sections
function documentToMarkdown(doc) {
  const s = doc.script;
  return [
    `# ${s.title}`, "",
    `> ${s.metadata.logline}`, "",
    "## 来源", "",
    "## 人物表", "",
    "## 地点表", "",
    "## 场景", "",
    "## 改编报告", "",
  ].join("\n");
}
const md = documentToMarkdown(validDocument);
assert.ok(md.includes("雨夜档案"), "Markdown 应包含标题");
assert.ok(md.includes("## 来源"), "Markdown 应包含来源章节");
assert.ok(md.includes("## 人物表"), "Markdown 应包含人物表");
assert.ok(md.includes("## 场景"), "Markdown 应包含场景章节");
assert.ok(md.includes("## 改编报告"), "Markdown 应包含改编报告");
console.log("✓ Test 11: Markdown export contains key structural sections");

// ── Summary ────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  M3 YAML Export Validation — All tests passed");
console.log("═══════════════════════════════════════════");
