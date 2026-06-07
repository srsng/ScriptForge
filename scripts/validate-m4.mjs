import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const route = read("src/app/api/generate/route.ts");
const stageSharedRoute = read("src/app/api/generate/_shared.ts");
const analyzerRoute = read("src/app/api/generate/analyzer/route.ts");
const plannerRoute = read("src/app/api/generate/planner/route.ts");
const screenwriterRoute = read("src/app/api/generate/screenwriter/route.ts");
const reporterRoute = read("src/app/api/generate/reporter/route.ts");
const assembleRoute = read("src/app/api/generate/assemble/route.ts");
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

for (const [label, source, tokens] of [
  ["analyzer route", analyzerRoute, ["export async function POST", "normalizeGenerationRequest", "runAnalyzerStage", "stageResponse"]],
  ["planner route", plannerRoute, ["export async function POST", "normalizeGenerationRequest", "runPlannerStage", "Expected analyzer stage output", "stageResponse"]],
  ["screenwriter route", screenwriterRoute, ["export async function POST", "normalizeGenerationRequest", "runScreenwriterStage", "Expected planner stage output", "stageResponse"]],
  ["reporter route", reporterRoute, ["export async function POST", "normalizeGenerationRequest", "runReporterStage", "Expected screenwriter stage output", "stageResponse"]],
  ["assemble route", assembleRoute, ["export async function POST", "assembleGenerationResult", "Expected complete stage outputs", "finalGenerationResponse"]],
]) {
  for (const token of tokens) {
    assert.match(source, new RegExp(token), `${label} missing ${token}`);
  }
}
assert.match(stageSharedRoute, /GenerationStageResult/, "shared stage route must type stage responses");
assert.match(stageSharedRoute, /metrics/, "shared stage route must expose stage metrics");
assert.match(stageSharedRoute, /prompt/, "shared stage route must expose prompt bundle");
assert.doesNotMatch(assembleRoute, /requestJsonFromModel|runAnalyzerStage|runPlannerStage|runScreenwriterStage|runReporterStage/, "assemble route must not call AI stages");

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
for (const [label, pattern] of [
  ["analyzer stage endpoint", /\/api\/generate\/analyzer/],
  ["planner stage endpoint", /\/api\/generate\/planner/],
  ["screenwriter stage endpoint", /\/api\/generate\/screenwriter/],
  ["reporter stage endpoint", /\/api\/generate\/reporter/],
  ["assemble endpoint", /\/api\/generate\/assemble/],
  ["stage request runner", /runStageRequest/],
  ["stage preview state", /generationStagePreviews/],
  ["stage preview prop", /stagePreviews/],
  ["stage result panel", /阶段结果/],
  ["elapsed loading label", /生成中\.\.\.\(\$\{generationElapsedSeconds\}s\)/],
]) {
  assert.match(workbenchUi, pattern, `workbench staged generation UI missing ${label}`);
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
  "完整原文",
  "规划与正文写作仍必须参考完整原文",
  "先读完整章节正文",
  "写正文时必须回看完整原文",
  "不得只复述 Analyzer 或 Planner 摘要",
  "characters",
  "locations",
  "adaptation_report",
  "剧本改写质量要求",
  "自然场景边界",
  "不要输出剧情摘要",
]) {
  assert.match(prompts, new RegExp(token), `prompts.ts must preserve source-grounded generation instruction: ${token}`);
}
assert.match(prompts, /buildPlannerPrompt[\s\S]*小说章节（完整原文，必须用于判断自然场景边界和戏剧规划）[\s\S]*chapterDigest\(request\)[\s\S]*Analyzer 输出/, "planner prompt must include full source chapters before analyzer output");
assert.match(prompts, /buildScreenwriterPrompt[\s\S]*小说章节（完整原文，必须用于支撑剧本正文扩写）[\s\S]*chapterDigest\(request\)[\s\S]*Analyzer 输出[\s\S]*Planner 输出/, "screenwriter prompt must include full source chapters before stage outputs");
assert.match(prompts, /beat_budget 必须根据目标时长、自然场面容量和原文可拍素材分配/, "planner prompt must derive beat_budget from source material");
assert.doesNotMatch(prompts, /唯一事实板/, "prompts must not make analyzer facts the only writing source");
assert.doesNotMatch(prompts, /export function flattenForSingleRequest/, "prompts.ts must not expose the old single-request flatten helper");
assert.doesNotMatch(prompts, /export function buildCombinedMessages/, "prompts.ts must not expose the old combined-message helper");

assert.match(types, /export type GenerationResult = GenerateAdaptationResult;/, "types.ts missing GenerationResult alias");
assert.match(types, /AnalyzerStageOutput/, "types.ts missing analyzer stage output type");
assert.match(types, /PlannerStageOutput/, "types.ts missing planner stage output type");
assert.match(types, /ScreenwriterStageOutput/, "types.ts missing screenwriter stage output type");
assert.match(types, /ReporterStageOutput/, "types.ts missing reporter stage output type");
assert.match(types, /GenerationStageOutputs/, "types.ts missing combined stage outputs type");
assert.match(types, /GenerationStageMetrics/, "types.ts missing stage metrics type");
assert.match(types, /GenerationStageResult/, "types.ts missing per-stage result type");
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
assert.match(generate, /export async function runAnalyzerStage/, "generation must export analyzer stage runner");
assert.match(generate, /export async function runPlannerStage/, "generation must export planner stage runner");
assert.match(generate, /export async function runScreenwriterStage/, "generation must export screenwriter stage runner");
assert.match(generate, /export async function runReporterStage/, "generation must export reporter stage runner");
assert.match(generate, /export function assembleGenerationResult/, "generation must export non-AI assembly");
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
assert.match(technicalDesign, /不使用 SSE 或 token streaming/, "technical design must document non-streaming staged HTTP behavior");
assert.match(technicalDesign, /多轮不是逐轮压缩原文/, "technical design must document full-source staged generation");
assert.match(technicalDesign, /Planner 与 Screenwriter 仍接收完整章节正文/, "technical design must document full source input for planning and writing");
assert.match(technicalDesign, /\/api\/generate\/analyzer/, "technical design must document analyzer stage endpoint");
assert.match(technicalDesign, /\/api\/generate\/assemble/, "technical design must document assemble endpoint");
assert.match(technicalDesign, /每个阶段请求返回后，UI 立即展示/, "technical design must document immediate per-stage display");
assert.match(technicalDesign, /GenerationStageMetrics/, "technical design must document stage metrics");
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
