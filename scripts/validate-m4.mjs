import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const route = read("src/app/api/generate/route.ts");
const page = read("src/app/page.tsx");
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

assert.match(types, /export type GenerationResult = GenerateAdaptationResult;/, "types.ts missing GenerationResult alias");
assert.match(generate, /severity: GenerationDiagnostic\["severity"\] = "info"/, "generate.ts diagnostic severity must match type");
assert.match(generate, /target_duration_minutes:/, "generation request normalization must include target duration");

console.log("validate:m4 ok");
