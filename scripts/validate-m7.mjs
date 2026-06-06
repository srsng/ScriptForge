#!/usr/bin/env node

/**
 * M7 — 剧本预览、来源追踪与改编报告验证脚本
 *
 * 这个脚本做静态契约验收，确保 M7 不退化成字段复述：
 *   1. 预览区域接入 ValidationResult
 *   2. 场景卡片展示来源章节、来源缺失/引用异常提示、戏剧目的、冲突、beats
 *   3. 改编报告把已发生的决策组织为保留、压缩/省略、合并/改写，并把后续修改建议放入后续改进
 *   4. M7 不改生成链路和 schema 契约
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertFile(path) {
  assert.ok(existsSync(join(root, path)), `Missing expected M7 file: ${path}`);
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

function assertComponentReceivesProp(path, componentName, propText) {
  const text = read(path);
  const match = text.match(new RegExp(`<${componentName}\\b[\\s\\S]*?/>`));
  assert.ok(match, `${path} should render ${componentName}`);
  assert.ok(
    match[0].includes(propText),
    `${path} should pass ${propText} into ${componentName}`,
  );
}

console.log("\n═══════════════════════════════════════════");
console.log("  M7 Preview, Source Trace and Report Validation");
console.log("═══════════════════════════════════════════");

const pkg = JSON.parse(read("package.json"));
assert.equal(
  pkg.scripts?.["validate:m7"],
  "node scripts/validate-m7.mjs",
  "package.json must expose validate:m7",
);
console.log("  ✓ package.json exposes validate:m7");

const files = [
  "src/components/workbench/WorkbenchShell.tsx",
  "src/components/workbench/ScriptPreviewPanel.tsx",
  "src/components/workbench/AdaptationReportPanel.tsx",
  "src/components/workbench/utils.ts",
];

for (const file of files) {
  assertFile(file);
}
console.log("  ✓ M7 component files exist");

assertComponentReceivesProp(
  "src/components/workbench/WorkbenchShell.tsx",
  "ScriptPreviewPanel",
  "validation={yamlValidation}",
);
assertComponentReceivesProp(
  "src/components/workbench/WorkbenchShell.tsx",
  "AdaptationReportPanel",
  "validation={yamlValidation}",
);
console.log("  ✓ WorkbenchShell passes validation into M7 panels");

assertContains("src/components/workbench/ScriptPreviewPanel.tsx", [
  "ValidationResult",
  "validationSummary",
  "校验状态",
  "validation.errors",
  "validation.warnings",
  "首次来源",
  "相关场景",
  "缺少来源",
  "引用不存在",
  "章节摘要",
  "原文事实板",
  "key_facts",
  "source_refs",
  "scene_card",
  "场景目标",
  "转折",
  "beat.function",
  "dramatic_purpose",
  "conflict",
  "adaptation_notes",
  "beatTypeLabel",
  "对白",
  "speaker",
  "source_chapters",
  "visual_notes",
  "渲染氛围",
]);
console.log("  ✓ ScriptPreviewPanel exposes readable preview, source trace and validation status");

assertContains("src/components/workbench/AdaptationReportPanel.tsx", [
  "ValidationResult",
  "validationSummary",
  "校验状态",
  "改编决策",
  "保留",
  "压缩/省略",
  "合并/改写",
  "后续改进",
  "后续修改建议",
  "全部应用",
  "onReviseByDirections([item])",
  "onReviseByDirections",
  "decisionCount",
  "不足 3 条",
  "scene.adaptation_notes",
  "main_conflicts",
  "omitted_or_compressed",
  "revision_suggestions",
]);
console.log("  ✓ AdaptationReportPanel organizes adaptation decisions");

const preview = read("src/components/workbench/ScriptPreviewPanel.tsx");
assert.doesNotMatch(preview, /excerpt/i, "M7 must not invent excerpt because the current schema does not define it");
assert.doesNotMatch(preview, /视觉提示/, "Preview should show visual_notes as 渲染氛围");

const report = read("src/components/workbench/AdaptationReportPanel.tsx");
assert.doesNotMatch(report, /硬编码|演示内容/, "Adaptation report must not hardcode demo content");
assertNotContains("src/components/workbench/AdaptationReportPanel.tsx", [
  'category: "后续修改建议"',
  "缺少说明：暂无可展示的保留、压缩、合并/改写或后续修改建议。",
]);
console.log("  ✓ M7 stays within current schema and real document data");

console.log("═══════════════════════════════════════════");
console.log("  M7 Preview, Source Trace and Report Validation — All tests passed");
console.log("═══════════════════════════════════════════");
