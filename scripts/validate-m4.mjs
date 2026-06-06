import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const route = read("src/app/api/generate/route.ts");
const page = read("src/app/page.tsx");
const workbench = read("src/components/workbench/WorkbenchShell.tsx");
const generationPanel = read("src/components/workbench/GenerationPanel.tsx");
const client = read("src/lib/generation/client.ts");
const technicalDesign = read("docs/technical-design.md");
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
  "resultSource",
  "needs_revision",
]) {
assert.match(route, new RegExp(token), `generate route missing ${token}`);
}
const legacyGeneratedResultFlag = ["used", "Fall", "back"].join("");
const legacyGeneratedStatus = ["status:", "\\s*", '"fall', 'back"'].join("");
const legacyGeneratedBuilder = ["build", "Fall", "back", "Document"].join("");
assert.doesNotMatch(route, new RegExp(legacyGeneratedResultFlag), "generate route must not expose a generated substitute success flag");
assert.doesNotMatch(route, /dotenv|\.env|SECRET|PRIVATE_KEY|API_KEY/i, "generate route must not read secrets directly");

const workbenchUi = [page, workbench, generationPanel].join("\n");

for (const [label, pattern] of [
  ["AI生成剧本初稿", /AI\s*生成剧本初稿/],
  ["generateDraft", /generateDraft/],
  ["/api/generate", /\/api\/generate/],
  ["generationDiagnostics", /generationDiagnostics/],
  ["setResultText", /setResultText/],
  ["setYamlText", /setYamlText/],
]) {
  assert.match(workbenchUi, pattern, `M6 workbench UI missing ${label}`);
}

for (const token of ["buildAnalyzerPrompt", "buildPlannerPrompt", "buildScreenwriterPrompt", "buildReporterPrompt"]) {
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
  "剧本改写质量要求",
  "自然场景边界",
  "不要输出剧情摘要",
]) {
  assert.match(prompts, new RegExp(token), `prompts.ts must preserve source-grounded generation instruction: ${token}`);
}
assert.doesNotMatch(prompts, /export function flattenForSingleRequest/, "prompts.ts must not expose the old single-request flatten helper");
assert.doesNotMatch(prompts, /export function buildCombinedMessages/, "prompts.ts must not expose the old combined-message helper");

assert.match(types, /export type GenerationResult = GenerateAdaptationResult;/, "types.ts missing GenerationResult alias");
assert.match(types, /AnalyzerStageOutput/, "types.ts missing analyzer stage output type");
assert.match(types, /PlannerStageOutput/, "types.ts missing planner stage output type");
assert.match(types, /ScreenwriterStageOutput/, "types.ts missing screenwriter stage output type");
assert.match(types, /ReporterStageOutput/, "types.ts missing reporter stage output type");
assert.match(types, /GenerationStageOutputs/, "types.ts missing combined stage outputs type");
assert.match(generate, /severity: GenerationDiagnostic\["severity"\] = "info"/, "generate.ts diagnostic severity must match type");
assert.match(generate, /evaluateScriptDensity/, "generation must run the density quality gate after schema validation");
assert.match(generate, /needs_revision/, "generation must return needs_revision for quality-failed AI drafts");
assert.match(generate, /buildAnalyzerPrompt/, "generation must call analyzer stage prompt");
assert.match(generate, /buildPlannerPrompt/, "generation must call planner stage prompt");
assert.match(generate, /buildScreenwriterPrompt/, "generation must call screenwriter stage prompt");
assert.match(generate, /buildReporterPrompt/, "generation must call reporter stage prompt");
assert.match(generate, /runStage/, "generation must execute explicit stage requests");
assert.match(generate, /parseAnalyzerOutput/, "generation must validate analyzer output");
assert.match(generate, /parsePlannerOutput/, "generation must validate planner output");
assert.match(generate, /parseScreenwriterOutput/, "generation must validate screenwriter output");
assert.match(generate, /parseReporterOutput/, "generation must validate reporter output");
assert.match(generate, /assembleDocument/, "generation must assemble final ScriptForgeDocument from stage outputs");
assert.match(generate, /GENERATION_STAGE_TIMEOUT_MS/, "generation must support configurable stage timeout");
assert.doesNotMatch(generate, /flattenForSingleRequest/, "production generation must not flatten stages into one model request");
assert.doesNotMatch(generate, new RegExp(legacyGeneratedBuilder), "production generation must not call generated substitute builder");
assert.doesNotMatch(generate, new RegExp(legacyGeneratedStatus), "production generation must not return generated substitute status");
assert.match(generate, /target_duration_minutes:/, "generation request normalization must include target duration");
assert.match(client, /timeoutMs\?: number/, "AI client must accept per-request timeout");
assert.match(client, /AbortSignal\.timeout\(timeoutMs\)/, "AI client must apply per-request timeout");
assert.match(client, /"OPENAI_API_KEY"/, "AI client must read OPENAI_API_KEY");
assert.match(technicalDesign, /OPENAI_API_KEY=/, "technical design must document OPENAI_API_KEY configuration");
assert.match(technicalDesign, /多轮串行 API 编排/, "technical design must document multi-round generation");
assert.match(technicalDesign, /GENERATION_STAGE_TIMEOUT_MS=/, "technical design must document stage timeout configuration");
assert.doesNotMatch(technicalDesign, /^AI_API_KEY=/m, "technical design must not document an unsupported AI_API_KEY alias");
assert.doesNotMatch(route, /Number\.isFinite\(Number\(target\.target_duration_minutes\)\)/, "generate route must reject invalid target duration instead of accepting any finite number");
assert.match(route, /normalizeTargetDuration/, "generate route must use shared target duration validation");
assert.match(route, /body\.request !== undefined[\s\S]*Invalid GenerationRequest payload/, "generate route must reject invalid explicit request payloads instead of falling back to workspace data");
assert.match(generate, /Number\.isInteger/, "generation request normalization must require integer target duration");
assert.match(generate, /throw new Error\([^)]*MIN_CHAPTER_COUNT/s, "generation must reject insufficient chapter input instead of returning an invalid substitute");
assert.doesNotMatch(workbench, /\?\s*\{\s*workspaceId:\s*activeWorkspace\.id,\s*persist:\s*true\s*\}/s, "workbench must not generate from stale workspace-only payload");
assert.doesNotMatch(workbench, /persist:/, "MVP workbench must persist full state through workspace API, not generate result-only persistence");
assert.match(workbench, /const currentGenerationRequest: GenerationRequest = useMemo\(\(\) => \(\{[\s\S]*chapters:\s*normalization\.chapters/s, "workbench must build the generation request from current normalized chapters");
assert.match(workbench, /request:\s*currentGenerationRequest/, "workbench must send the currently edited generation request");
assert.match(page, /WorkbenchShell/, "page.tsx must delegate to the M6 workbench shell");
assert.match(route, /stageOutputs/, "generate route must expose optional stageOutputs for diagnostics");

console.log("validate:m4 ok");
