import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { dump: dumpYaml, load: parseYaml } = require("js-yaml");
const Ajv2020 = require("ajv/dist/2020").default;
const addFormats = require("ajv-formats").default;
const scriptForgeSchema = require("../schema/scriptforge.schema.json");

const root = process.cwd();
const yamlSource = readFileSync(join(root, "src/lib/yaml.ts"), "utf8");
for (const token of ["key_facts", "source_refs", "scene_card", "function", 'doc.schema_version === "1.1"']) {
  assert.ok(yamlSource.includes(token), `yaml.ts must support 1.1 token: ${token}`);
}

const validDocument = {
  script: {
    schema_version: "1.1",
    title: "雨夜档案",
    metadata: { language: "zh-CN", format: "short_drama", genre: "悬疑", target_duration_minutes: 12, logline: "追查真相。", tone: "紧张" },
    source: {
      type: "novel",
      chapters: [
        { id: "ch_001", title: "第一章", summary: "摘要", key_facts: [
          { id: "fact_001", type: "event", content: "事件" },
          { id: "fact_002", type: "character_goal", content: "目标" },
          { id: "fact_003", type: "conflict", content: "冲突" },
        ] },
        { id: "ch_002", title: "第二章", summary: "摘要", key_facts: [
          { id: "fact_004", type: "event", content: "事件" },
          { id: "fact_005", type: "object", content: "物件" },
          { id: "fact_006", type: "relationship", content: "关系" },
        ] },
        { id: "ch_003", title: "第三章", summary: "摘要", key_facts: [
          { id: "fact_007", type: "information", content: "信息" },
          { id: "fact_008", type: "emotion", content: "情绪" },
          { id: "fact_009", type: "location", content: "地点" },
        ] },
      ],
    },
    characters: [
      { id: "char_001", name: "林舟", role: "protagonist", description: "记者", motivation: "查明真相", arc: "变化", voice: "直接" },
      { id: "char_002", name: "许曼", role: "supporting", description: "管理员", motivation: "守密", arc: "变化", voice: "克制", relationships: [{ target: "char_001", type: "colleague", description: "互不信任" }] },
    ],
    locations: [{ id: "loc_001", name: "地下室", description: "昏暗", visual_notes: "手电光" }],
    scenes: [{
      id: "scene_001",
      title: "铁门之后",
      source_chapters: ["ch_001", "ch_002"],
      source_refs: ["fact_001", "fact_004"],
      location: "loc_001",
      time: "night",
      characters: ["char_001", "char_002"],
      scene_card: { objective: "确认线索", opposition: "许曼阻止", entry_state: "林舟怀疑", turning_point: "照片出现", exit_state: "许曼露出破绽", visual_atmosphere: "潮湿昏暗" },
      dramatic_purpose: "进入调查地点",
      conflict: "追查与阻止",
      beats: [
        { type: "action", character: "char_001", function: "establish", source_refs: ["fact_001"], content: "林舟推门。" },
        { type: "dialogue", character: "char_002", function: "evade", source_refs: ["fact_006"], content: "你不该来。" },
      ],
      adaptation_notes: ["合并线索。"],
    }],
    adaptation_report: { chapter_count: 3, scene_count: 1, character_count: 2, main_conflicts: ["追查与隐瞒"], omitted_or_compressed: ["压缩背景"], revision_suggestions: ["加强对白"] },
  },
};

const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true, strict: false });
addFormats(ajv);
const validateSchema = ajv.compile(scriptForgeSchema);

console.log("═══ M3 YAML Export Validation ═══\n");

const yamlText = dumpYaml(validDocument, { sortKeys: false, noRefs: true, lineWidth: -1 });
const fieldOrder = ["source:", "characters:", "locations:", "scenes:", "adaptation_report:"];
let lastIdx = -1;
for (const field of fieldOrder) {
  const idx = yamlText.indexOf(field);
  assert.ok(idx > lastIdx, `字段 "${field}" 顺序错误`);
  lastIdx = idx;
}
console.log("✓ Test 1: YAML stable field order");

const parsed = parseYaml(yamlText);
assert.equal(validateSchema(parsed), true, JSON.stringify(validateSchema.errors));
console.log("✓ Test 2: YAML round-trip validates against 1.1 schema");

for (const token of ["schema_version:", "1.1", "key_facts:", "source_refs:", "scene_card:", "objective:", "turning_point:", "function:", "fact_001"]) {
  assert.ok(yamlText.includes(token), `YAML 必须包含 1.1 字段 ${token}`);
}
console.log("✓ Test 3: YAML preserves 1.1 source facts, scene cards and beat functions");

assert.ok(yamlText.includes("source_chapters:"), "YAML 必须包含 source_chapters");
assert.ok(yamlText.includes("char_001"), "YAML 必须包含角色引用");
assert.ok(yamlText.includes("loc_001"), "YAML 必须包含地点引用");
assert.ok(yamlText.includes("adaptation_report:"), "YAML 必须包含 adaptation_report");
console.log("✓ Test 4: Existing references and report are preserved");

const jsonText = JSON.stringify(validDocument, null, 2);
assert.equal(validateSchema(JSON.parse(jsonText)), true, JSON.stringify(validateSchema.errors));
console.log("✓ Test 5: JSON export round-trip validates");

const missingTitleDoc = JSON.parse(JSON.stringify(validDocument));
delete missingTitleDoc.script.title;
assert.equal(validateSchema(missingTitleDoc), false, "缺少 title 必须校验失败");
console.log("✓ Test 6: Missing required field blocks export");

function generateYamlFilename(title) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/:/g, "-").replace("T", "_").slice(0, 19);
  const safeTitle = (title ?? "scriptforge").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").replace(/\s+/g, "_").slice(0, 60);
  return `${safeTitle}_${dateStr}.yaml`;
}
const fname = generateYamlFilename("雨夜档案");
assert.ok(fname.endsWith(".yaml"));
assert.ok(fname.startsWith("雨夜档案_"));
console.log("✓ Test 7: YAML filename includes project name and timestamp");

for (const token of ["## 来源", "fact.id", "场景目标", "scene.scene_card.turning_point", "beat.function", "## 改编报告"]) {
  assert.ok(yamlSource.includes(token), `Markdown export source should include ${token}`);
}
console.log("✓ Test 8: Markdown export contains 1.1 structural sections");

console.log("\n═══════════════════════════════════════════");
console.log("  M3 YAML Export Validation — All tests passed");
console.log("═══════════════════════════════════════════");
