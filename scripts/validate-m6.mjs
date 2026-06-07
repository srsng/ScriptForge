#!/usr/bin/env node

/**
 * M6 — 作者工作台 UI 验证脚本
 *
 * 这个脚本不启动浏览器，专门做 UI 模块的静态契约验收：
 *   1. 工作台从单页堆叠拆成明确组件
 *   2. 仍然使用 M1-M5 已有 API，并接入生成质量门禁契约
 *   3. 预览消费人物、地点、场景、来源章节和改编报告
 *   4. UI 明确展示生成、打磨、整理、检查和导出状态
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertFile(path) {
  assert.ok(existsSync(join(root, path)), `Missing expected M6 file: ${path}`);
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
console.log("  M6 Author Workbench UI Validation");
console.log("═══════════════════════════════════════════");

const componentFiles = [
  "src/components/workbench/WorkbenchShell.tsx",
  "src/components/workbench/InputPanel.tsx",
  "src/components/workbench/PreferencePanel.tsx",
  "src/components/workbench/ProcessGuide.tsx",
  "src/components/workbench/GenerationPanel.tsx",
  "src/components/workbench/QualityPanel.tsx",
  "src/components/workbench/ScriptPreviewPanel.tsx",
  "src/components/workbench/AdaptationReportPanel.tsx",
  "src/components/workbench/YamlEditorPanel.tsx",
  "src/components/workbench/WorkspaceList.tsx",
  "src/components/workbench/utils.ts",
];

for (const file of componentFiles) {
  assertFile(file);
}
console.log("  ✓ Workbench component files exist");

assertContains("src/app/page.tsx", [
  "WorkbenchShell",
  "@/components/workbench/WorkbenchShell",
]);
console.log("  ✓ App page delegates to WorkbenchShell");

assertContains("src/components/workbench/WorkbenchShell.tsx", [
  'fetch(`/api/samples/quan-zhi-gao-shou?chapters=${sampleChapterCount}`)',
  'fetch("/api/workspaces")',
  '"/api/generate/analyzer"',
  'fetch("/api/generate/assemble"',
  "fetch(endpoint",
  'fetch("/api/revise"',
  'fetch("/api/validate"',
  'fetch("/api/repair"',
  "saveAsNewWorkspace",
  "documentToYaml",
  "documentToJson",
  "documentToMarkdown",
  "resultSource",
  "needs_revision",
  "ai_draft",
  "sampleChapterCount",
  "ProcessGuide",
  "validation",
  "revising",
  "onReviseByDirections",
  "RepairResult",
]);
console.log("  ✓ Workbench keeps M1-M5 API wiring");

assertContains("src/components/workbench/GenerationPanel.tsx", [
  "needs_revision",
  "生成剧本初稿",
  "需要打磨",
  "剧本已生成",
  "生成",
  "创作进度",
  "篇幅参考",
]);
console.log("  ✓ Generation panel exposes user-facing run-state language");

assertContains("src/components/workbench/QualityPanel.tsx", [
  "ValidationResult",
  "RepairResult",
  "查看整理建议",
  /应用\s+\{repairResult\.appliedFixes\.length\}\s+项整理/,
  "必须处理",
  "建议完善",
  "needsRevision",
  "不足以支撑目标时长",
]);
assert.ok(
  !read("src/components/workbench/QualityPanel.tsx").includes("resultSourceLabel"),
  "QualityPanel must not duplicate result source; GenerationPanel owns it",
);
console.log("  ✓ Quality panel exposes validation and repair state without duplicate source");

assertContains("src/components/workbench/ProcessGuide.tsx", [
  "准备章节",
  "设置目标",
  "生成剧本",
  "检查剧本",
  "整理或重试",
  "导出交付",
  "已完成",
  "当前",
  "待处理",
]);
assertNotContains("src/components/workbench/ProcessGuide.tsx", [
  new RegExp(["来源线索", "不存在"].join("")),
]);
console.log("  ✓ Process guide exposes current flow without duplicate source warning");

assertContains("src/components/workbench/InputPanel.tsx", [
  "随机载入《全职高手》片段",
  "连续章节数",
  "min={3}",
  "内置测试样本",
]);
console.log("  ✓ Input panel exposes Quan Zhi Gao Shou sample controls");

assertContains("src/components/workbench/ScriptPreviewPanel.tsx", [
  "characters",
  "locations",
  "scenes",
  "source_chapters",
  "key_facts",
  "source_refs",
  "scene_card",
  "beat.function",
  "beats",
  "dramatic_purpose",
  "conflict",
]);
console.log("  ✓ Preview panel consumes script assets and source references");

assertContains("src/components/workbench/AdaptationReportPanel.tsx", [
  "adaptation_report",
  "main_conflicts",
  "omitted_or_compressed",
  "revision_suggestions",
  "后续改进",
  "全部应用",
  "onReviseByDirections([item])",
  "onReviseByDirections",
  "自定义 AI 改写",
  "按自定义要求改写",
]);
console.log("  ✓ Adaptation report panel consumes report fields");

assertContains("src/components/workbench/YamlEditorPanel.tsx", [
  "重新检查",
  "复制 YAML",
  "下载 YAML 编辑稿",
  "下载 Markdown 阅读稿",
  "确认改动",
  "暂不能导出",
  "exportBlockedReason",
]);
console.log("  ✓ YAML editor exposes validation-gated export");

assertContains("src/components/workbench/WorkbenchShell.tsx", [
  "yamlHasDraftChanges",
  "yamlHasValidationErrors",
  "yamlExportBlockedReason",
  "导出内容有未确认的编辑",
]);
console.log("  ✓ YAML export blocks dirty or invalid drafts");

const pageText = read("src/app/page.tsx");
assert.ok(
  pageText.length < 1000,
  "src/app/page.tsx should be a thin entrypoint after M6 component split",
);
console.log("  ✓ Page entrypoint is thin");

console.log("═══════════════════════════════════════════");
console.log("  M6 Author Workbench UI Validation — All tests passed");
console.log("═══════════════════════════════════════════");
