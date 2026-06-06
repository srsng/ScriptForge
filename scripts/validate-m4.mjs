import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const route = read("src/app/api/generate/route.ts");
const page = read("src/app/page.tsx");
const client = read("src/lib/generation/client.ts");
const technicalDesign = read("docs/technical-design.md");
const fallback = read("src/lib/generation/fallback.ts");
const generate = read("src/lib/generation/generate.ts");
const prompts = read("src/lib/generation/prompts.ts");
const types = read("src/lib/generation/types.ts");
const pkg = JSON.parse(read("package.json"));

assert.equal(pkg.scripts?.["validate:m4"], "node scripts/validate-m4.mjs", "package.json must expose validate:m4");

for (const token of [
  "export async function POST",
  "workspaceId",
  "sourceText",
  "generateScriptForgeDocument",
  "documentToYaml",
  "diagnostics",
  "usedFallback",
]) {
  assert.match(route, new RegExp(token), `generate route missing ${token}`);
}
assert.doesNotMatch(route, /dotenv|\.env|SECRET|PRIVATE_KEY|API_KEY/i, "generate route must not read secrets directly");

for (const token of [
  "AI生成剧本初稿",
  "generateDraft",
  "/api/generate",
  "generationDiagnostics",
  "setResultText",
  "setYamlText",
]) {
  assert.match(page, new RegExp(token), `page.tsx missing ${token}`);
}

for (const token of ["buildGenerationPrompts", "flattenForSingleRequest", "buildCombinedMessages"]) {
  assert.match(prompts, new RegExp(`export function ${token}`), `prompts.ts missing exported ${token}`);
}
for (const token of [
  "Analyzer",
  "Planner",
  "Screenwriter",
  "Reporter",
  "只允许使用输入章节",
  "characters",
  "locations",
  "adaptation_report",
]) {
  assert.match(prompts, new RegExp(token), `prompts.ts must preserve source-grounded generation instruction: ${token}`);
}

assert.match(types, /export type GenerationResult = GenerateAdaptationResult;/, "types.ts missing GenerationResult alias");
assert.match(generate, /severity: GenerationDiagnostic\["severity"\] = "info"/, "generate.ts diagnostic severity must match type");
assert.match(generate, /target_duration_minutes:/, "generation request normalization must include target duration");
assert.match(client, /"OPENAI_API_KEY"/, "AI client must read OPENAI_API_KEY");
assert.match(technicalDesign, /OPENAI_API_KEY=/, "technical design must document OPENAI_API_KEY configuration");
assert.doesNotMatch(technicalDesign, /^AI_API_KEY=/m, "technical design must not document an unsupported AI_API_KEY alias");
assert.doesNotMatch(route, /Number\.isFinite\(Number\(target\.target_duration_minutes\)\)/, "generate route must reject invalid target duration instead of accepting any finite number");
assert.match(route, /normalizeTargetDuration/, "generate route must use shared target duration validation");
assert.match(route, /body\.request !== undefined[\s\S]*Invalid GenerationRequest payload/, "generate route must reject invalid explicit request payloads instead of falling back to workspace data");
assert.match(generate, /Number\.isInteger/, "generation request normalization must require integer target duration");
assert.match(generate, /throw new Error\([^)]*MIN_CHAPTER_COUNT/s, "generation must reject insufficient chapter input instead of returning invalid fallback");
assert.match(fallback, /request\.chapters\.length < MIN_CHAPTER_COUNT/, "fallback builder must guard its minimum chapter precondition");
assert.doesNotMatch(page, /\?\s*\{\s*workspaceId:\s*activeWorkspace\.id,\s*persist:\s*true\s*\}/s, "page must not generate from stale workspace-only payload");
assert.match(page, /const currentGenerationRequest: GenerationRequest = \{[\s\S]*chapters:\s*normalization\.chapters/s, "page must build the generation request from current normalized chapters");
assert.match(page, /request:\s*currentGenerationRequest/, "page must send the currently edited generation request");

console.log("validate:m4 ok");
