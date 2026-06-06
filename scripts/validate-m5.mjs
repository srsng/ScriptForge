#!/usr/bin/env node

/**
 * M5 — 自动修复与容错验证脚本
 *
 * 构建一个带多种可修复错误的脚本文档，验证：
 *   1. repair API 能接收并修复 schema 必填缺失
 *   2. repair API 能修复引用错误（location、characters、beat.character、relationship.target、source_chapters、source_refs）
 *   3. 修复后再次 validate 必须无 error
 *   4. repair 必须幂等
 *   5. YAML 格式和裸 script 输入也能被修复
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { dump: dumpYaml } = require("js-yaml");

// ── Helper: build a damaged document ────────────────────────────────────────

function buildDamagedDocument() {
  return {
    script: {
      schema_version: "1.1",
      title: "M5测试剧本",
      metadata: {
        language: "zh-CN",
        format: "short_drama",
        genre: "测试",
        target_duration_minutes: 10,
        logline: "测试自动修复功能",
        tone: "轻松",
      },
      source: {
        type: "novel",
        chapters: [
          { id: "ch_001", title: "第一章", summary: "主角收到任务。", key_facts: [
            { id: "fact_001", type: "event", content: "主角收到任务。" },
            { id: "fact_002", type: "character_goal", content: "主角想完成任务。" },
            { id: "fact_003", type: "conflict", content: "反派阻止主角。" },
          ] },
          { id: "ch_002", title: "第二章", summary: "反派设置阻碍。", key_facts: [
            { id: "fact_004", type: "event", content: "反派设置阻碍。" },
            { id: "fact_005", type: "object", content: "洞口有机关。" },
            { id: "fact_006", type: "relationship", content: "双方互相试探。" },
          ] },
          { id: "ch_003", title: "第三章", summary: "双方正面交锋。", key_facts: [
            { id: "fact_007", type: "information", content: "任务真相暴露。" },
            { id: "fact_008", type: "emotion", content: "主角从犹豫到主动。" },
            { id: "fact_009", type: "location", content: "交锋发生在山洞。" },
          ] },
        ],
      },
      characters: [
        {
          id: "char_001",
          name: "英雄",
          role: "protagonist",
          description: "主角",
          motivation: "完成任务",
          arc: "从犹豫到主动",
          voice: "直接",
          relationships: [
            { target: "char_999", type: "宿敌", description: "无效关系目标" },
          ],
        },
        {
          id: "char_002",
          name: "反派",
          role: "antagonist",
          description: "反派",
          motivation: "阻止主角",
          arc: "逐步失控",
          voice: "克制",
          relationships: [],
        },
      ],
      locations: [
        {
          id: "loc_001",
          name: "山洞",
          description: "神秘山洞",
          visual_notes: "冷色调，空间狭窄",
        },
      ],
      scenes: [
        {
          id: "scene_001",
          // title missing intentionally
          source_chapters: ["ch_999"], // invalid reference — not in source.chapters
          source_refs: ["fact_999"], // invalid reference — not in key_facts
          location: "loc_999", // invalid reference
          characters: ["char_999"], // invalid reference
          time: "白天",
          scene_card: {
            objective: "主角想进入山洞确认任务。",
            opposition: "反派用言语和机关阻止。",
            entry_state: "主角仍在犹豫。",
            turning_point: "机关暴露真正入口。",
            exit_state: "主角决定主动进入。",
            visual_atmosphere: "冷色光线压在狭窄洞口。",
          },
          dramatic_purpose: "介绍",
          conflict: "无",
          beats: [
            {
              type: "dialogue",
              character: "char_999", // invalid reference
              function: "probe",
              source_refs: ["fact_999"], // invalid reference
              content: "你好",
            },
            {
              type: "action",
              function: "establish",
              source_refs: ["fact_001"],
              content: "英雄走进山洞",
              // beat has no character — valid for action
            },
          ],
        },
        {
          id: "scene_002",
          title: "第二场景",
          source_chapters: ["ch_001"], // valid
          source_refs: ["fact_001"], // valid
          location: "loc_001", // valid
          characters: ["char_001"], // valid
          time: "夜晚",
          scene_card: {
            objective: "主角想确认入口。",
            opposition: "环境阻碍行动。",
            entry_state: "主角谨慎靠近。",
            turning_point: "入口机关响动。",
            exit_state: "主角确认入口存在。",
            visual_atmosphere: "夜色压低视线。",
          },
          dramatic_purpose: "发展",
          conflict: "轻微",
          beats: [
            {
              type: "dialogue",
              character: "char_001", // valid
              function: "reaction",
              source_refs: ["fact_002"],
              content: "我来了",
            },
          ],
        },
      ],
      adaptation_report: {
        chapter_count: 3,
        scene_count: 2,
        character_count: 2,
        main_conflicts: ["主角与反派争夺任务结果"],
        omitted_or_compressed: ["压缩支线"],
        revision_suggestions: ["强化结尾转折"],
      },
    },
  };
}

// ── Helper: POST to repair API ──────────────────────────────────────────────

const base = process.env.SCRIPTFORGE_APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_BASE_URL ?? "http://127.0.0.1:3000";

async function postRepair(payload) {
  const response = await fetch(`${base}/api/repair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Repair API returned ${response.status}: ${text}`);
  }
  return response.json();
}

async function postValidate(payload) {
  const response = await fetch(`${base}/api/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Validate API returned ${response.status}: ${text}`);
  }
  return response.json();
}

// ── Test 1: Repair document via JSON ────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 1: Repair damaged document (JSON)");
console.log("═══════════════════════════════════════════");

const damagedDoc = buildDamagedDocument();

// First verify the document has validation errors
const preValidation = await postValidate({ document: damagedDoc });
console.log(`  Pre-repair errors: ${preValidation.errors.length}`);
assert.equal(preValidation.errors.length, 1, "Damaged document should first report the schema error");
assert.equal(preValidation.errors[0]?.keyword, "required", "Damaged document should start with a missing required field");

// Now repair
const repairResult = await postRepair({ document: damagedDoc });
console.log(`  Repair status: ${repairResult.status}`);
console.log(`  Applied fixes: ${repairResult.appliedFixes.length}`);
console.log(`  Post-repair diagnostics: ${repairResult.diagnostics.length}`);

assert.equal(repairResult.status, "ok", "Repair should fully fix the damaged document");
assert.equal(repairResult.appliedFixes.length, 8, "Should apply one fix per damaged field");
assert.equal(repairResult.diagnostics.length, 0, "Fully repaired document should have no diagnostics");
assert.ok(repairResult.document, "Repair should return a document");

// ── Test 2: Check that repair fixed the schema missing title ────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 2: Schema missing field repair");
console.log("═══════════════════════════════════════════");

const hasTitleFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("title") && f.path.includes("scene_001")
);
assert.ok(hasTitleFix, "Should have fixed missing title for scene-1");
console.log("  ✓ Missing title was added");

// ── Test 3: Check that repair fixed reference errors ────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 3: Reference error repairs");
console.log("═══════════════════════════════════════════");

const locationFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("location") && f.path.includes("scene_001")
);
assert.ok(locationFix, "Should have fixed invalid scene.location reference");
console.log("  ✓ Scene location reference fixed");

const characterFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("characters") && f.path.includes("scene_001") && !f.path.includes("beat")
);
assert.ok(characterFix, "Should have fixed invalid scene.characters reference");
console.log("  ✓ Scene characters reference fixed");

const beatCharacterFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("beat") && f.path.includes("character")
);
assert.ok(beatCharacterFix, "Should have fixed invalid beat.character reference");
console.log("  ✓ Beat character reference fixed");

const sourceChapterFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("source_chapters") || f.path.includes("source")
);
assert.ok(sourceChapterFix, "Should have fixed invalid source_chapters reference");
console.log("  ✓ Source chapters reference fixed");

const sourceRefsFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("source_refs")
);
assert.ok(sourceRefsFix, "Should have fixed invalid source_refs reference");
console.log("  ✓ Source facts reference fixed");

const relationshipFix = repairResult.appliedFixes.some(
  (f) => f.path.includes("relationships") && f.path.includes("target")
);
assert.ok(relationshipFix, "Should have fixed invalid relationship.target reference");
assert.equal(
  repairResult.document.script.characters[0].relationships[0].target,
  "char_002",
  "Relationship target should avoid pointing to itself when another character exists",
);
console.log("  ✓ Relationship target reference fixed");

// ── Test 4: Verify the repaired document passes validation ──────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 4: Repaired document validation");
console.log("═══════════════════════════════════════════");

const postValidation = await postValidate({ document: repairResult.document });
console.log(`  Post-repair validation errors: ${postValidation.errors.length}`);
console.log(`  Post-repair validation warnings: ${postValidation.warnings.length}`);

assert.equal(postValidation.errors.length, 0, "Repaired document should have no validation errors");
console.log("  ✓ Repaired document has no validation errors");

// ── Test 5: Repair is idempotent ────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 5: Idempotent repair");
console.log("═══════════════════════════════════════════");

const secondRepairResult = await postRepair({ document: repairResult.document });
console.log(`  Second repair status: ${secondRepairResult.status}`);
console.log(`  Second applied fixes: ${secondRepairResult.appliedFixes.length}`);
console.log(`  Second diagnostics: ${secondRepairResult.diagnostics.length}`);

assert.equal(secondRepairResult.status, "ok", "Second repair should still be ok");
assert.equal(secondRepairResult.appliedFixes.length, 0, "Second repair should not apply fixes");
assert.equal(secondRepairResult.diagnostics.length, 0, "Second repair should have no diagnostics");
console.log("  ✓ Repair is idempotent");

// ── Test 6: Repair via YAML ─────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 6: Repair via YAML text");
console.log("═══════════════════════════════════════════");

const damagedYaml = dumpYaml(damagedDoc);
const yamlRepairResult = await postRepair({ yamlText: damagedYaml });
console.log(`  YAML repair status: ${yamlRepairResult.status}`);
console.log(`  YAML applied fixes: ${yamlRepairResult.appliedFixes.length}`);

assert.ok(yamlRepairResult.appliedFixes.length > 0, "YAML repair should apply fixes");
assert.equal(yamlRepairResult.status, "ok", "YAML repair should fully fix the damaged document");
assert.ok(yamlRepairResult.yamlText, "YAML repair should return yamlText");
console.log("  ✓ YAML repair works");

// ── Test 7: Re-validate repaired YAML ───────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 7: Re-validated repaired YAML");
console.log("═══════════════════════════════════════════");

const yamlPostValidation = await postValidate({ yamlText: yamlRepairResult.yamlText });
console.log(`  YAML post-repair errors: ${yamlPostValidation.errors.length}`);
assert.equal(yamlPostValidation.errors.length, 0, "YAML repair should remove all validation errors");
console.log("  ✓ Repaired YAML has no validation errors");

// ── Test 8: Repair bare script object ───────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 8: Repair bare script object");
console.log("═══════════════════════════════════════════");

const bareScriptRepair = await postRepair(damagedDoc.script);
console.log(`  Bare script repair status: ${bareScriptRepair.status}`);
console.log(`  Bare script applied fixes: ${bareScriptRepair.appliedFixes.length}`);

assert.equal(bareScriptRepair.status, "ok", "Bare script repair should be accepted");
assert.ok(bareScriptRepair.document?.script, "Bare script repair should return wrapped document");
assert.equal(bareScriptRepair.appliedFixes.length, 8, "Bare script repair should apply the expected fixes");
console.log("  ✓ Bare script repair works");

// ── Test 9: Check that status is correct ────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  Test 9: Repair result structure");
console.log("═══════════════════════════════════════════");

assert.ok(["ok", "partial", "failed"].includes(repairResult.status), "Status should be valid");
assert.ok(Array.isArray(repairResult.appliedFixes), "appliedFixes should be array");
assert.ok(Array.isArray(repairResult.diagnostics), "diagnostics should be array");

repairResult.appliedFixes.forEach((fix, i) => {
  assert.ok(typeof fix.path === "string", `Fix ${i} should have path`);
  assert.ok(typeof fix.message === "string", `Fix ${i} should have message`);
  assert.ok(typeof fix.description === "string", `Fix ${i} should have description`);
});
console.log("  ✓ Repair result structure is valid");

// ── Summary ─────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log("  M5 Auto-Repair Validation — All tests passed");
console.log(`  Total fixes applied (JSON): ${repairResult.appliedFixes.length}`);
console.log(`  Total fixes applied (YAML): ${yamlRepairResult.appliedFixes.length}`);
console.log("═══════════════════════════════════════════");
