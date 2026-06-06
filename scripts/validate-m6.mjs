#!/usr/bin/env node

/**
 * M6 — 作者工作台 UI 验证脚本
 *
 * 这个脚本不启动浏览器，专门做 UI 模块的静态契约验收：
 *   1. 工作台从单页堆叠拆成明确组件
 *   2. 仍然使用 M1-M5 已有 API，不改后端契约
 *   3. 预览消费人物、地点、场景、来源章节和改编报告
 *   4. UI 明确展示 AI / fallback / repair / 校验 / 导出状态
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

console.log("\n═══════════════════════════════════════════");
console.log("  M6 Author Workbench UI Validation");
console.log("═══════════════════════════════════════════");

const componentFiles = [
  "src/components/workbench/WorkbenchShell.tsx",
  "src/components/workbench/InputPanel.tsx",
  "src/components/workbench/PreferencePanel.tsx",
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
  'fetch("/api/samples/public-domain-novel")',
  'fetch("/api/workspaces")',
  'fetch("/api/generate"',
  'fetch("/api/validate"',
  'fetch("/api/repair"',
  "documentToYaml",
  "documentToJson",
  "documentToMarkdown",
  "usedFallback",
  "validation",
  "RepairResult",
]);
console.log("  ✓ Workbench keeps M1-M5 API wiring");

assertContains("src/components/workbench/GenerationPanel.tsx", [
  "AI",
  "fallback",
  "repair",
  "生成",
  "校验",
  "导出",
]);
console.log("  ✓ Generation panel exposes run-state language");

assertContains("src/components/workbench/QualityPanel.tsx", [
  "ValidationResult",
  "RepairResult",
  "自动修复",
  "错误",
  "警告",
  "fallback",
]);
console.log("  ✓ Quality panel exposes validation and repair state");

assertContains("src/components/workbench/ScriptPreviewPanel.tsx", [
  "characters",
  "locations",
  "scenes",
  "source_chapters",
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
]);
console.log("  ✓ Adaptation report panel consumes report fields");

assertContains("src/components/workbench/YamlEditorPanel.tsx", [
  "重新校验",
  "复制",
  "下载 YAML",
  "下载 JSON",
  "下载 MD",
  "导出已阻止",
]);
console.log("  ✓ YAML editor exposes validation-gated export");

const pageText = read("src/app/page.tsx");
assert.ok(
  pageText.length < 1000,
  "src/app/page.tsx should be a thin entrypoint after M6 component split",
);
console.log("  ✓ Page entrypoint is thin");

console.log("═══════════════════════════════════════════");
console.log("  M6 Author Workbench UI Validation — All tests passed");
console.log("═══════════════════════════════════════════");
