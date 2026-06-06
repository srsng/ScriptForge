#!/usr/bin/env node

/**
 * Generation quality gate validation.
 *
 * This script guards the production contract described in 剧本生成优化.md:
 * prompt density must ask for performable scripts, schema success is not
 * enough, generated substitutes must not masquerade as success, and the
 * workbench must expose needs_revision distinctly.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

process.on("warning", (warning) => {
  if (warning.code !== "MODULE_TYPELESS_PACKAGE_JSON") {
    console.warn(warning);
  }
});

const { evaluateScriptDensity } = await import("../src/lib/generation/quality.ts");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertFile(path) {
  assert.ok(existsSync(join(root, path)), `Missing expected file: ${path}`);
}

function assertContains(path, patterns) {
  const text = read(path);
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      assert.match(text, pattern, `${path} should match ${pattern}`);
    } else {
      assert.ok(text.includes(pattern), `${path} should contain ${pattern}`);
    }
  }
}

function assertNotContains(path, patterns) {
  const text = read(path);
  for (const pattern of patterns) {
    if (pattern instanceof RegExp) {
      assert.doesNotMatch(text, pattern, `${path} should not match ${pattern}`);
    } else {
      assert.ok(!text.includes(pattern), `${path} should not contain ${pattern}`);
    }
  }
}

console.log("\n═══════════════════════════════════════════");
console.log("  Generation Quality Validation");
console.log("═══════════════════════════════════════════");

const pkg = JSON.parse(read("package.json"));
const legacySubstituteTerm = ["fall", "back"].join("");
const legacyResultFlag = ["used", "Fall", "back"].join("");
const legacyStatus = ["status:", " ", '"fall', 'back"'].join("");
const legacyBuilder = ["build", "Fall", "back", "Document("].join("");
const legacyStatusType = new RegExp(`export type GenerationStatus = "ai_success" \\| "${legacySubstituteTerm}" \\| "degraded";`);
assert.equal(
  pkg.scripts?.["validate:generation-quality"],
  "node --no-warnings scripts/validate-generation-quality.mjs",
  "package.json must expose validate:generation-quality",
);
console.log("  ✓ package script exists");

assertFile("src/lib/generation/quality.ts");
assertContains("src/lib/generation/quality.ts", [
  "export function evaluateScriptDensity",
  "LOW_TOTAL_BEATS",
  "SCENE_TOO_SHORT",
  "LOW_DIALOGUE_RATIO",
  "LOW_DIALOGUE_COUNT",
  "BEAT_TOO_THIN",
  "DURATION_UNDERFILLED",
  /targetDuration\s*\*\s*3/,
  /"error"/,
  /"warning"/,
]);
console.log("  ✓ quality evaluator contract exists");

assertContains("src/lib/generation/prompts.ts", [
  "buildScriptDensityInstruction",
  "不要输出剧情摘要",
  "可直接拍摄",
  "排练",
  "target_duration_minutes",
  "内容密度",
  "每个 scene",
  "beats",
  "dialogue beats",
]);
assertNotContains("src/lib/generation/prompts.ts", [
  "规划 3-5 个场景",
  "3-5 场戏",
  "抽取 2~3 个核心场景",
]);
console.log("  ✓ prompt density language exists");

assertContains("src/lib/generation/types.ts", [
  '"needs_revision"',
  '"error"',
  '"quality"',
]);
assertNotContains("src/lib/generation/types.ts", [
  legacyStatusType,
]);
console.log("  ✓ generation status contract exists");

assertContains("src/lib/generation/generate.ts", [
  "evaluateScriptDensity",
  "qualityDiagnostics",
  '"needs_revision"',
  "qualityDiagnostics.some",
]);
assertNotContains("src/lib/generation/generate.ts", [
  legacyBuilder,
  legacyStatus,
  "AI 不可用，返回内置可校验改编文档",
  "返回可校验替代文档",
]);
console.log("  ✓ generation flow rejects poor density without generated substitutes");

assertContains("src/app/api/generate/route.ts", [
  "resultSource",
  '"ai_draft"',
  "result.status === \"needs_revision\"",
]);
assertNotContains("src/app/api/generate/route.ts", [
  legacyResultFlag,
  legacyStatus,
]);
console.log("  ✓ generate API exposes revision status without substitute success");

assertContains("src/components/workbench/WorkbenchShell.tsx", [
  '"needs_revision"',
  '"success"',
  "ai_draft",
  "结构化草稿",
]);
assertNotContains("src/components/workbench/WorkbenchShell.tsx", [
  legacyResultFlag,
  `已生成 ${legacySubstituteTerm} 降级剧本初稿`,
]);
assertContains("src/components/workbench/GenerationPanel.tsx", [
  "needs_revision",
  "内容密度不足",
  "结构化草稿",
]);
assertContains("src/components/workbench/QualityPanel.tsx", [
  "needsRevision",
  "不满足目标时长",
]);
console.log("  ✓ workbench exposes needs_revision distinctly");

assertContains("src/components/workbench/utils.ts", [
  '"ai_draft"',
  "AI 结构化草稿",
]);
assertContains("src/types/scriptforge.ts", [
  '"ai_draft"',
]);
assertContains("src/lib/workspace-data.ts", [
  '"ai_draft"',
]);
console.log("  ✓ workspace result source supports AI drafts");

function buildRequest() {
  return {
    chapters: [
      { id: "ch_001", title: "第一章", content: "第一章内容" },
      { id: "ch_002", title: "第二章", content: "第二章内容" },
      { id: "ch_003", title: "第三章", content: "第三章内容" },
    ],
    target: {
      format: "short_drama",
      genre: "悬疑剧情",
      target_duration_minutes: 12,
      tone: "紧凑、可拍摄",
    },
  };
}

function buildDocument(beatsPerScene, dialoguePerScene, contentPrefix = "足量可演的动作与对白推进") {
  const scenes = Array.from({ length: 3 }, (_, sceneIndex) => ({
    id: `scene_${String(sceneIndex + 1).padStart(3, "0")}`,
    title: `第${sceneIndex + 1}场`,
    source_chapters: [`ch_${String(sceneIndex + 1).padStart(3, "0")}`],
    location: "loc_001",
    time: "夜内",
    characters: ["char_001", "char_002"],
    dramatic_purpose: "推进人物目标与冲突",
    conflict: "主角与阻碍者围绕关键线索展开攻防",
    beats: Array.from({ length: beatsPerScene }, (_, beatIndex) => {
      const isDialogue = beatIndex < dialoguePerScene;
      return isDialogue
        ? { type: "dialogue", character: beatIndex % 2 === 0 ? "char_001" : "char_002", content: `${contentPrefix}：第${sceneIndex + 1}场第${beatIndex + 1}轮对白推动关系变化。` }
        : { type: "action", character: "char_001", content: `${contentPrefix}：第${sceneIndex + 1}场第${beatIndex + 1}个动作包含停顿、反应和环境反馈。` };
    }),
    adaptation_notes: ["保留原章节冲突并扩写为场面过程"],
  }));

  return {
    script: {
      schema_version: "1.0",
      title: "质量门禁测试剧本",
      metadata: {
        language: "zh-CN",
        format: "short_drama",
        genre: "悬疑剧情",
        target_duration_minutes: 12,
        logline: "主角在三章线索中逼近真相",
        tone: "紧凑、可拍摄",
      },
      source: {
        type: "novel",
        chapters: [
          { id: "ch_001", title: "第一章", summary: "第一章摘要" },
          { id: "ch_002", title: "第二章", summary: "第二章摘要" },
          { id: "ch_003", title: "第三章", summary: "第三章摘要" },
        ],
      },
      characters: [
        { id: "char_001", name: "主角", role: "protagonist", description: "主角", motivation: "查明真相", arc: "从被动到主动", voice: "直接" },
        { id: "char_002", name: "阻碍者", role: "antagonist", description: "阻碍者", motivation: "隐藏真相", arc: "从克制到失控", voice: "含蓄" },
      ],
      locations: [
        { id: "loc_001", name: "旧屋", description: "冲突发生地点", visual_notes: "低照度、可拍摄" },
      ],
      scenes,
      adaptation_report: {
        chapter_count: 3,
        scene_count: scenes.length,
        character_count: 2,
        main_conflicts: ["主角追索真相与阻碍者隐藏事实之间的冲突"],
        omitted_or_compressed: ["压缩重复背景"],
        revision_suggestions: ["继续强化对白潜台词"],
      },
    },
  };
}

const thinDiagnostics = evaluateScriptDensity(buildDocument(4, 1, "短句"), buildRequest());
assert.ok(thinDiagnostics.some((item) => item.message.includes("LOW_TOTAL_BEATS") && item.severity === "error"), "Thin document must fail LOW_TOTAL_BEATS");
assert.ok(thinDiagnostics.some((item) => item.message.includes("DURATION_UNDERFILLED") && item.severity === "error"), "Thin document must fail DURATION_UNDERFILLED");

const denseDiagnostics = evaluateScriptDensity(buildDocument(14, 5), buildRequest());
assert.equal(denseDiagnostics.filter((item) => item.severity === "error").length, 0, "Dense document must not produce quality errors");
console.log("  ✓ quality evaluator rejects thin drafts and accepts dense scripts");

console.log("═══════════════════════════════════════════");
console.log("  Generation Quality Validation — All checks passed");
console.log("═══════════════════════════════════════════");
