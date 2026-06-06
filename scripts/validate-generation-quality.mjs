#!/usr/bin/env node

/**
 * Generation quality gate validation.
 *
 * This script guards the production contract described in 剧本生成优化.md:
 * prompts must guide natural scene boundaries and performable writing,
 * schema success is not enough, generated substitutes must not masquerade
 * as success, and the workbench must expose needs_revision distinctly.
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

function findDiagnostic(diagnostics, code) {
  return diagnostics.find((item) => item.message.includes(code));
}

console.log("\n═══════════════════════════════════════════");
console.log("  Generation Quality Validation");
console.log("═══════════════════════════════════════════");

const pkg = JSON.parse(read("package.json"));
const legacySubstituteTerm = ["fall", "back"].join("");
const legacyResultFlag = ["used", "Fall", "back"].join("");
const legacyStatus = ["status:", " ", '"fall', 'back"'].join("");
const legacyBuilder = ["build", "Fall", "back", "Document("].join("");
const legacyBeatEstimate = ["每分钟约", " 3 个 beats"].join("");
const legacyChapterExcerptLabel = ["正文", "摘录"].join("");
const legacyStatusType = new RegExp(`export type GenerationStatus = "ai_success" \\| "${legacySubstituteTerm}" \\| "degraded";`);
assert.equal(
  pkg.scripts?.["validate:generation-quality"],
  "node --no-warnings scripts/validate-generation-quality.mjs",
  "package.json must expose validate:generation-quality",
);
console.log("  ✓ package script exists");

assertFile("src/lib/generation/quality.ts");
assertFile("src/lib/generation/revise.ts");
assertFile("src/app/api/revise/route.ts");
assertFile("src/app/api/generate/_shared.ts");
assertFile("src/app/api/generate/analyzer/route.ts");
assertFile("src/app/api/generate/planner/route.ts");
assertFile("src/app/api/generate/screenwriter/route.ts");
assertFile("src/app/api/generate/reporter/route.ts");
assertFile("src/app/api/generate/assemble/route.ts");
assertContains("src/lib/generation/quality.ts", [
  "export function evaluateScriptDensity",
  "buildScriptCapacityBudget",
  "summarizeScriptCapacity",
  "ERROR_BEAT_FILL_RATIO",
  "ERROR_DURATION_FILL_RATIO",
  "ERROR_DIALOGUE_FILL_RATIO",
  "ERROR_TEXT_FILL_RATIO",
  "RESULT_ONLY_ACTION",
  "DRY_DIALOGUE",
  "POSSIBLE_ARTIFICIAL_SCENE_SPLIT",
  "LOW_TOTAL_BEATS",
  "DURATION_TEXT_UNDERFILLED",
  "SCENE_TEXT_TOO_SHORT",
  "SCENE_TOO_SHORT",
  "LOW_DIALOGUE_RATIO",
  "LOW_DIALOGUE_COUNT",
  "LOW_DIALOGUE_ROUNDS",
  "BEAT_TOO_THIN",
  "SUMMARY_LIKE_BEATS",
  "DURATION_UNDERFILLED",
  "FACT_REF_UNDERUSED",
  "SOURCE_UNDERUSED",
  "SCENE_NO_TURNING_POINT",
  "SCENE_STATIC_ARC",
  "DIALOGUE_NO_EXCHANGE",
  "BEAT_FUNCTION_MISSING_ARC",
  "场景数仅供参考",
  "自然场景边界",
  /minTotalBeats:\s*targetDurationMinutes\s*\*\s*8/,
  /minDialogueBeats:\s*targetDurationMinutes\s*\*\s*4/,
  /minScriptChars:\s*targetDurationMinutes\s*\*\s*500/,
  /"error"/,
  /"warning"/,
]);
assertNotContains("src/lib/generation/quality.ts", [
  "LOW_SCENE_COUNT",
  /minScenes:/,
  /chapterCount\s*\*\s*2/,
  /Math\.ceil\(targetDurationMinutes\s*\/\s*2\)/,
  /targetDuration\s*\*\s*3/,
  legacyBeatEstimate,
]);
console.log("  ✓ quality evaluator contract exists");

assertContains("src/lib/generation/prompts.ts", [
  "buildScriptDensityInstruction",
  "buildInternalAdaptationWorkflowInstruction",
  "buildAnalyzerPrompt",
  "buildPlannerPrompt",
  "buildScreenwriterPrompt",
  "buildReporterPrompt",
  "buildScriptCapacityBudget",
  "正文：",
  "剧本改写质量要求（剧本正文写作要求）",
  "容量参考",
  "先让场面成立",
  "Source Facts",
  "原文事实板",
  "key_facts",
  "Dramatic Plan",
  "戏剧路线",
  "Natural Scene Cards",
  "自然场面卡",
  "scene_card",
  "Dense Beats",
  "剧本正文",
  "source_refs",
  "function",
  "scene objective",
  "opposition",
  "entry state",
  "turning point",
  "exit state",
  "visual atmosphere",
  "beat budget",
  "所有中间资产都必须进入 1.1 文档",
  "场景数量由故事素材自行决定",
  "自然场景边界",
  "不要为了凑场景数量拆分连续场景",
  "渲染氛围",
  "动作过程",
  "潜台词",
  "动作配合",
  "不要输出剧情摘要",
  "可直接拍摄",
  "排练",
  "target_duration_minutes",
  "每个 scene",
  "beats",
  "dialogue beats",
  "needs_revision",
  "完整原文",
  "规划与正文写作仍必须参考完整原文",
  "先读完整章节正文",
  "beat_budget 必须根据目标时长、自然场面容量和原文可拍素材分配",
  "写正文时必须回看完整原文",
  "不得只复述 Analyzer 或 Planner 摘要",
]);
assertContains("src/lib/generation/prompts.ts", [
  /buildPlannerPrompt[\s\S]*小说章节（完整原文，必须用于判断自然场景边界和戏剧规划）[\s\S]*chapterDigest\(request\)[\s\S]*Analyzer 输出/,
  /buildScreenwriterPrompt[\s\S]*小说章节（完整原文，必须用于支撑剧本正文扩写）[\s\S]*chapterDigest\(request\)[\s\S]*Analyzer 输出[\s\S]*Planner 输出/,
]);
assertNotContains("src/lib/generation/prompts.ts", [
  "flattenForSingleRequest",
  "buildCombinedMessages",
  "唯一事实板",
  /slice\(0,\s*900\)/,
  legacyChapterExcerptLabel,
  "硬性容量预算",
  "内容密度",
  "规划 3-5 个场景",
  "3-5 场戏",
  "抽取 2~3 个核心场景",
  "不新增 Schema 字段",
  "不输出中间资产",
]);
console.log("  ✓ five-layer prompt workflow is explicit in Schema 1.1");

assertContains("src/lib/generation/revise.ts", [
  "reviseScriptForgeDocument",
  "后续修改建议",
  "Source Facts",
  "Dramatic Plan",
  "Natural Scene Cards",
  "Dense Beats",
  "buildInternalAdaptationWorkflowInstruction",
  'schema_version = "1.1"',
  "key_facts",
  "source_refs",
  "scene_card",
  "beats[].function",
  "如果只收到一条建议",
  "只改写与该建议相关的场景和报告内容",
  "重新检查自然场景边界",
  "不要为了应用建议硬拆 scene",
  "entry_state、turning_point、exit_state",
  "scenes / beats / dialogue / action",
  "revision_suggestions 字段在产品中表示",
  "evaluateScriptDensity",
  "validateScriptForgeDocument",
  '"needs_revision"',
]);
assertNotContains("src/lib/generation/revise.ts", [
  /slice\(0,\s*1200\)/,
]);
assertContains("src/app/api/revise/route.ts", [
  "reviseScriptForgeDocument",
  "RevisionRequest",
  "resultSource",
  '"ai_draft"',
  "result.status === \"needs_revision\"",
]);
assertContains("src/components/workbench/WorkbenchShell.tsx", [
  'fetch("/api/revise"',
  "handleReviseByDirections",
  "revising",
  "后续修改建议改写",
]);
assertContains("src/components/workbench/AdaptationReportPanel.tsx", [
  "后续修改建议",
  "后续改进",
  "全部应用",
  "onReviseByDirections([item])",
  "onReviseByDirections",
  "revision_suggestions",
]);
console.log("  ✓ revision workflow applies visible direction rewrites");

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
  "buildAnalyzerPrompt",
  "buildPlannerPrompt",
  "buildScreenwriterPrompt",
  "buildReporterPrompt",
  "parseAnalyzerOutput",
  "parsePlannerOutput",
  "parseScreenwriterOutput",
  "parseReporterOutput",
  "assembleDocument",
  "runAnalyzerStage",
  "runPlannerStage",
  "runScreenwriterStage",
  "runReporterStage",
  "assembleGenerationResult",
  "stageOutputs",
  "GENERATION_STAGE_TIMEOUT_MS",
  "evaluateScriptDensity",
  "qualityDiagnostics",
  '"needs_revision"',
  "qualityDiagnostics.some",
]);
assertNotContains("src/lib/generation/generate.ts", [
  "flattenForSingleRequest",
  legacyBuilder,
  legacyStatus,
  "AI 不可用，返回内置可校验改编文档",
  "返回可校验替代文档",
]);
assertContains("src/lib/generation/client.ts", [
  "ModelRequestOptions",
  "timeoutMs?: number",
  "AbortSignal.timeout(timeoutMs)",
]);
assertContains("src/lib/generation/types.ts", [
  "AnalyzerStageOutput",
  "PlannerStageOutput",
  "ScreenwriterStageOutput",
  "ReporterStageOutput",
  "GenerationStageOutputs",
  "GenerationStageMetrics",
  "GenerationStageResult",
]);
assertContains("docs/technical-design.md", [
  "多轮串行 API 编排",
  "不使用 SSE 或 token streaming",
  "多轮不是逐轮压缩原文",
  "Planner 与 Screenwriter 仍接收完整章节正文",
  "key_facts` 是追溯和校验索引",
  "Screenwriter 必须回看完整章节正文",
  "/api/generate/analyzer",
  "/api/generate/planner",
  "/api/generate/screenwriter",
  "/api/generate/reporter",
  "/api/generate/assemble",
  "每个阶段请求返回后，UI 立即展示",
  "AnalyzerStageOutput",
  "PlannerStageOutput",
  "ScreenwriterStageOutput",
  "ReporterStageOutput",
  "GenerationStageMetrics",
  "GENERATION_STAGE_TIMEOUT_MS=",
]);
console.log("  ✓ generation flow uses explicit multi-round stages without generated substitutes");

assertContains("src/app/api/generate/_shared.ts", [
  "stageResponse",
  "GenerationStageResult",
  "diagnostics",
  "metrics",
  "prompt",
  "model",
]);
assertContains("src/app/api/generate/analyzer/route.ts", [
  "runAnalyzerStage",
  "stageResponse",
  "normalizeGenerationRequest",
]);
assertContains("src/app/api/generate/planner/route.ts", [
  "runPlannerStage",
  "Expected analyzer stage output",
  "stageResponse",
]);
assertContains("src/app/api/generate/screenwriter/route.ts", [
  "runScreenwriterStage",
  "Expected planner stage output",
  "stageResponse",
]);
assertContains("src/app/api/generate/reporter/route.ts", [
  "runReporterStage",
  "Expected screenwriter stage output",
  "stageResponse",
]);
assertContains("src/app/api/generate/assemble/route.ts", [
  "assembleGenerationResult",
  "Expected complete stage outputs",
  "finalGenerationResponse",
]);
assertNotContains("src/app/api/generate/assemble/route.ts", [
  "requestJsonFromModel",
  "runAnalyzerStage",
  "runPlannerStage",
  "runScreenwriterStage",
  "runReporterStage",
]);
console.log("  ✓ staged generation API exposes each model request separately");

assertContains("src/app/api/generate/route.ts", [
  "resultSource",
  '"ai_draft"',
  "result.status === \"needs_revision\"",
  "stageOutputs",
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
  "runStageRequest",
  "/api/generate/analyzer",
  "/api/generate/planner",
  "/api/generate/screenwriter",
  "/api/generate/reporter",
  "/api/generate/assemble",
  "generationStagePreviews",
  "setGenerationStagePreviews",
  "GenerationStageMetrics",
]);
assertNotContains("src/components/workbench/WorkbenchShell.tsx", [
  legacyResultFlag,
  `已生成 ${legacySubstituteTerm} 降级剧本初稿`,
]);
assertContains("src/components/workbench/GenerationPanel.tsx", [
  "needs_revision",
  "剧本质量不足",
  "结构化草稿",
  "stagePreviews",
  "阶段结果",
  "details",
  "targetDurationMinutes",
  "CAPACITY_SUMMARY",
  "无法支撑",
]);
assertContains("src/components/workbench/QualityPanel.tsx", [
  "needsRevision",
  "不满足目标时长",
  "剧本质量要求",
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

function buildRequest(targetDurationMinutes = 12) {
  return {
    chapters: [
      { id: "ch_001", title: "第一章", content: "第一章内容" },
      { id: "ch_002", title: "第二章", content: "第二章内容" },
      { id: "ch_003", title: "第三章", content: "第三章内容" },
    ],
    target: {
      format: "short_drama",
      genre: "悬疑剧情",
      target_duration_minutes: targetDurationMinutes,
      tone: "紧凑、可拍摄",
    },
  };
}

function longContent(prefix, sceneIndex, beatIndex) {
  if (prefix === "短句") return `短句${sceneIndex + 1}-${beatIndex + 1}`;
  if (prefix === "摘要") return `人物发现线索并继续推进计划${sceneIndex + 1}-${beatIndex + 1}`;
  return `${prefix}：第${sceneIndex + 1}场第${beatIndex + 1}拍，人物先停住脚步观察对方反应，手里的文件被重新按回桌面，屏幕光落在脸上，语气和动作都把冲突继续往前推。`;
}

function buildDocument(sceneCount, beatsPerScene, dialoguePerScene, contentPrefix = "足量可演的动作与对白推进", options = {}) {
  const extraBeats = options.extraBeats ?? 0;
  const factIds = Array.from({ length: 9 }, (_, index) => `fact_${String(index + 1).padStart(3, "0")}`);
  const scenes = Array.from({ length: sceneCount }, (_, sceneIndex) => ({
    id: `scene_${String(sceneIndex + 1).padStart(3, "0")}`,
    title: `第${sceneIndex + 1}场`,
    source_chapters: [`ch_${String((sceneIndex % 3) + 1).padStart(3, "0")}`],
    source_refs: [factIds[sceneIndex % factIds.length], factIds[(sceneIndex + 1) % factIds.length]],
    location: "loc_001",
    time: "夜内",
    characters: ["char_001", "char_002"],
    scene_card: {
      objective: `主角在第${sceneIndex + 1}场逼近关键线索`,
      opposition: "阻碍者用隐瞒、反问和环境压力拖延",
      entry_state: `主角带着疑问进入第${sceneIndex + 1}场`,
      turning_point: `第${sceneIndex + 1}场中关键证据改变双方权力位置`,
      exit_state: `主角离开第${sceneIndex + 1}场时掌握新的追查方向`,
      visual_atmosphere: "冷光压在桌面文件上，门外脚步声让对话不断被迫停顿",
    },
    dramatic_purpose: "推进人物目标与冲突",
    conflict: "主角与阻碍者围绕关键线索展开攻防",
    beats: Array.from({ length: beatsPerScene + (sceneIndex === sceneCount - 1 ? extraBeats : 0) }, (_, beatIndex) => {
      const isDialogue = beatIndex < dialoguePerScene;
      const functions = ["probe", "evade", "pressure", "reveal", "turn", "reaction", "establish", "pause"];
      const beatFunction = functions[beatIndex % functions.length];
      const source_refs = [factIds[(sceneIndex + beatIndex) % factIds.length]];
      return isDialogue
        ? { type: "dialogue", character: beatIndex % 2 === 0 ? "char_001" : "char_002", function: beatFunction, source_refs, content: longContent(contentPrefix, sceneIndex, beatIndex) }
        : { type: "action", character: "char_001", function: beatFunction, source_refs, content: longContent(contentPrefix, sceneIndex, beatIndex) };
    }),
    adaptation_notes: ["保留原章节冲突并扩写为场面过程"],
  }));

  return {
    script: {
      schema_version: "1.1",
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
          {
            id: "ch_001",
            title: "第一章",
            summary: "第一章摘要",
            key_facts: [
              { id: "fact_001", type: "event", content: "第一章事件事实" },
              { id: "fact_002", type: "character_goal", content: "第一章人物目标事实" },
              { id: "fact_003", type: "conflict", content: "第一章冲突事实" },
            ],
          },
          {
            id: "ch_002",
            title: "第二章",
            summary: "第二章摘要",
            key_facts: [
              { id: "fact_004", type: "event", content: "第二章事件事实" },
              { id: "fact_005", type: "relationship", content: "第二章关系事实" },
              { id: "fact_006", type: "object", content: "第二章物件事实" },
            ],
          },
          {
            id: "ch_003",
            title: "第三章",
            summary: "第三章摘要",
            key_facts: [
              { id: "fact_007", type: "information", content: "第三章信息事实" },
              { id: "fact_008", type: "emotion", content: "第三章情绪事实" },
              { id: "fact_009", type: "location", content: "第三章地点事实" },
            ],
          },
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

const thinDiagnostics = evaluateScriptDensity(buildDocument(3, 4, 1, "短句"), buildRequest());
assert.ok(!thinDiagnostics.some((item) => item.message.includes("LOW_SCENE_COUNT")), "Thin document must not fail because of hard-coded scene count");
assert.ok(thinDiagnostics.some((item) => item.message.includes("LOW_TOTAL_BEATS") && item.severity === "error"), "Thin document must fail LOW_TOTAL_BEATS");
assert.ok(thinDiagnostics.some((item) => item.message.includes("DURATION_TEXT_UNDERFILLED") && item.severity === "error"), "Thin document must fail DURATION_TEXT_UNDERFILLED");
assert.ok(thinDiagnostics.some((item) => item.message.includes("SCENE_TEXT_TOO_SHORT") && item.severity === "error"), "Thin document must fail SCENE_TEXT_TOO_SHORT");
assert.ok(thinDiagnostics.some((item) => item.message.includes("LOW_DIALOGUE_ROUNDS") && item.severity === "error"), "Thin document must fail LOW_DIALOGUE_ROUNDS");
assert.ok(thinDiagnostics.some((item) => item.message.includes("SUMMARY_LIKE_BEATS") && item.severity === "error"), "Thin document must fail SUMMARY_LIKE_BEATS");
assert.ok(thinDiagnostics.some((item) => item.message.includes("RESULT_ONLY_ACTION") && item.severity === "error"), "Thin document must fail RESULT_ONLY_ACTION");
assert.ok(thinDiagnostics.some((item) => item.message.includes("DRY_DIALOGUE") && item.severity === "error"), "Thin document must fail DRY_DIALOGUE");
assert.ok(thinDiagnostics.some((item) => item.message.includes("DURATION_UNDERFILLED") && item.severity === "error"), "Thin document must fail DURATION_UNDERFILLED");

const structurallyWeakDocument = buildDocument(3, 32, 12);
for (const scene of structurallyWeakDocument.script.scenes) {
  scene.scene_card.turning_point = "无";
  scene.scene_card.exit_state = scene.scene_card.entry_state;
  scene.beats = scene.beats.map((beat) => ({ ...beat, function: "establish" }));
  for (const beat of scene.beats) {
    if (beat.type === "dialogue") beat.character = "char_001";
  }
}
structurallyWeakDocument.script.scenes[0].source_refs = ["fact_001"];
for (const scene of structurallyWeakDocument.script.scenes) {
  for (const beat of scene.beats) beat.source_refs = ["fact_001"];
}
const structuralDiagnostics = evaluateScriptDensity(structurallyWeakDocument, buildRequest());
assert.ok(structuralDiagnostics.some((item) => item.message.includes("SCENE_NO_TURNING_POINT") && item.severity === "error"), "Missing scene turning points must fail");
assert.ok(structuralDiagnostics.some((item) => item.message.includes("SCENE_STATIC_ARC") && item.severity === "error"), "Static scene arcs must fail");
assert.ok(structuralDiagnostics.some((item) => item.message.includes("DIALOGUE_NO_EXCHANGE") && item.severity === "error"), "Missing dialogue exchange must fail");
assert.ok(structuralDiagnostics.some((item) => item.message.includes("BEAT_FUNCTION_MISSING_ARC") && item.severity === "error"), "Missing core beat functions must fail");
assert.ok(structuralDiagnostics.some((item) => item.message.includes("FACT_REF_UNDERUSED") && item.severity === "error"), "Unused source facts must fail");
console.log("  ✓ structure quality gate catches missing scene arc, exchange and fact usage");

const nearTargetThinDiagnostics = evaluateScriptDensity(
  buildDocument(6, 11, 5, "摘要", { extraBeats: 4 }),
  buildRequest(9),
);
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "LOW_TOTAL_BEATS")?.severity, "warning", "Near-target beats should warn instead of failing");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "DURATION_UNDERFILLED")?.severity, "warning", "Near-target duration should warn instead of failing");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "LOW_DIALOGUE_COUNT")?.severity, "warning", "Near-target dialogue count should warn instead of failing");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "LOW_DIALOGUE_ROUNDS")?.severity, "warning", "Near-target dialogue rounds should warn instead of failing");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "DURATION_TEXT_UNDERFILLED")?.severity, "error", "Thin text should still fail when far below target");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "SUMMARY_LIKE_BEATS")?.severity, "error", "Summary-like beats should still fail when severe");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "RESULT_ONLY_ACTION")?.severity, "error", "Result-only action should still fail when severe");
assert.equal(findDiagnostic(nearTargetThinDiagnostics, "DRY_DIALOGUE")?.severity, "error", "Dry dialogue should still fail when severe");
assert.equal(
  nearTargetThinDiagnostics.filter((item) => item.message.includes("SCENE_TEXT_TOO_SHORT")).length,
  1,
  "Scene text diagnostics should be aggregated instead of repeated per scene",
);
console.log("  ✓ near-target quantity gaps warn while thin summary drafts still fail");

const naturalOneSceneDocument = buildDocument(1, 96, 48);
naturalOneSceneDocument.script.scenes[0].source_chapters = ["ch_001", "ch_002", "ch_003"];
naturalOneSceneDocument.script.scenes[0].source_refs = [
  "fact_001",
  "fact_002",
  "fact_003",
  "fact_004",
  "fact_005",
  "fact_006",
  "fact_007",
  "fact_008",
  "fact_009",
];
const naturalOneSceneDiagnostics = evaluateScriptDensity(naturalOneSceneDocument, buildRequest());
assert.ok(!naturalOneSceneDiagnostics.some((item) => item.message.includes("LOW_SCENE_COUNT")), "A dense natural one-scene script must not fail scene count");
assert.equal(naturalOneSceneDiagnostics.filter((item) => item.severity === "error").length, 0, "A dense natural one-scene script must not produce quality errors");
console.log("  ✓ scene count is not a hard-coded failure condition");

const artificialSplitDocument = buildDocument(3, 32, 16);
for (const scene of artificialSplitDocument.script.scenes) {
  scene.source_chapters = ["ch_001"];
  scene.location = "loc_001";
  scene.time = "夜内";
  scene.characters = ["char_001", "char_002"];
}
const artificialSplitDiagnostics = evaluateScriptDensity(artificialSplitDocument, buildRequest());
assert.equal(findDiagnostic(artificialSplitDiagnostics, "POSSIBLE_ARTIFICIAL_SCENE_SPLIT")?.severity, "warning", "Artificial scene splitting should warn instead of hard-failing");
console.log("  ✓ artificial scene splitting is surfaced as a warning");

const denseDiagnostics = evaluateScriptDensity(buildDocument(6, 16, 8), buildRequest());
assert.equal(denseDiagnostics.filter((item) => item.severity === "error").length, 0, "Dense document must not produce quality errors");
console.log("  ✓ quality evaluator rejects thin drafts and accepts dense scripts");

console.log("═══════════════════════════════════════════");
console.log("  Generation Quality Validation — All checks passed");
console.log("═══════════════════════════════════════════");
