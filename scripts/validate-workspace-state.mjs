#!/usr/bin/env node

/**
 * Workspace state persistence validation.
 *
 * Verifies the MVP design for saving and restoring the full author workbench.
 * state.json is the single persisted workspace source; this MVP intentionally
 * does not carry request.json/result.json legacy compatibility paths.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const pkg = JSON.parse(read("package.json"));
const workspaceData = read("src/lib/workspace-data.ts");
const workspaceRoute = read("src/app/api/workspaces/[id]/route.ts");
const shell = read("src/components/workbench/WorkbenchShell.tsx");
const workspaceList = read("src/components/workbench/WorkspaceList.tsx");
const types = read("src/types/scriptforge.ts");

assert.equal(
  pkg.scripts?.["validate:workspace-state"],
  "node scripts/validate-workspace-state.mjs",
  "package.json must expose validate:workspace-state",
);

for (const token of [
  "export type WorkspaceState",
  'schema_version: "1.1"',
  "yamlText",
  "yamlValidation",
  "repairResult",
  "generationDiagnostics",
  "generationStagePreviews",
  "resultSource",
]) {
  assert.match(types, new RegExp(token), `types must define full WorkspaceState token: ${token}`);
}

for (const token of [
  "state_path",
  "state.json",
  "SaveWorkspaceStateInput",
  "saveWorkspaceState",
  "normalizeWorkspaceState",
]) {
  assert.match(workspaceData, new RegExp(token), `workspace-data must persist full state token: ${token}`);
}
for (const banned of [
  "request_path",
  "result_path",
  "SaveWorkspaceResultInput",
  "saveWorkspaceResult",
  "buildLegacyWorkspaceState",
  "result.json",
  "request.json",
]) {
  assert.doesNotMatch(workspaceData, new RegExp(banned), `workspace-data must not keep legacy token: ${banned}`);
}

assert.match(
  workspaceData,
  /state\s*:\s*WorkspaceState/,
  "WorkspaceRecord must expose restored WorkspaceState",
);
assert.match(
  workspaceData,
  /writeJsonAtomic[\s\S]*state\.json/s,
  "createWorkspace must write state.json",
);
assert.match(
  workspaceData,
  /readJsonFile<WorkspaceState>[\s\S]*entry\.state_path/s,
  "getWorkspace must read state.json",
);

assert.match(
  workspaceRoute,
  /body as Record<string, unknown>/,
  "workspace PUT route must inspect request body shape",
);
assert.match(
  workspaceRoute,
  /input\.state[\s\S]*saveWorkspaceState/s,
  "workspace PUT route must support saving full state",
);
assert.doesNotMatch(workspaceRoute, /saveWorkspaceResult|input\.result/, "workspace PUT route must not keep legacy result saves");

for (const token of [
  "buildWorkspaceState",
  "applyWorkspaceState",
  "saveCurrentWorkspaceState",
  "hasUnsavedState",
  "保存当前工作区",
  "另存为新工作区",
]) {
  assert.match(shell, new RegExp(token), `WorkbenchShell must wire full state persistence token: ${token}`);
}
assert.ok(
  shell.includes("JSON.stringify({ state })"),
  "WorkbenchShell must save full state payload",
);

for (const token of ["state_path", "已有状态"]) {
  assert.match(workspaceList, new RegExp(token), `WorkspaceList must expose state persistence token: ${token}`);
}

console.log("validate:workspace-state ok");
