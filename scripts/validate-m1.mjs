import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const mustNotExist = [
  "samples/scriptforge-demo.json",
  "src/lib/fixtures.ts",
];
const bannedSourcePatterns = [
  /demoScriptDocument/,
  /loadDemoGenerationRequest/,
  /scriptforge-demo\.json/,
  /两点十七分/,
  /林雾/,
  /西游记短剧改编工作区/,
  /古典神话、轻快冒险/,
];
const sourceFiles = [
  "src/app/page.tsx",
  "src/components/workbench/WorkbenchShell.tsx",
  "src/lib/input.ts",
  "src/lib/sample-input.ts",
  "src/lib/workspace-data.ts",
  "src/types/scriptforge.ts",
];

async function exists(relativePath) {
  try {
    await readFile(path.join(root, relativePath), "utf8");
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function apiBaseFromArgs() {
  const flagIndex = process.argv.indexOf("--api");
  const cliBase = flagIndex >= 0 ? process.argv[flagIndex + 1] ?? "" : "";
  return (cliBase || process.env.M1_API_BASE || "").replace(/\/+$/, "");
}

async function fetchJson(base, route, options) {
  const response = await fetch(`${base}${route}`, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${route} returned non-JSON ${response.status}: ${text.slice(0, 160)}`);
  }
  return { response, data };
}

function buildValidationDocument() {
  return {
    script: {
      schema_version: "1.0",
      title: "M1 API validation result",
      metadata: {
        language: "zh-CN",
        format: "short_drama",
        genre: "validation",
        target_duration_minutes: 1,
        logline: "A minimal externally supplied result used only for API validation.",
        tone: "neutral",
      },
      source: {
        type: "novel",
        chapters: [
          { id: "chapter-1", title: "Validation chapter", summary: "Validation-only source trace." },
        ],
      },
      characters: [
        {
          id: "validator",
          name: "Validator",
          role: "supporting",
          description: "Validation-only character.",
          motivation: "Confirm reloadable result storage.",
          arc: "Created externally, saved through API, then reloaded.",
          voice: "Concise",
        },
      ],
      locations: [
        {
          id: "validation-room",
          name: "Validation Room",
          description: "A neutral test location.",
          visual_notes: "Plain workspace verification scene.",
        },
      ],
      scenes: [
        {
          id: "scene-1",
          title: "Save and reload",
          source_chapters: ["chapter-1"],
          location: "validation-room",
          time: "present",
          characters: ["validator"],
          dramatic_purpose: "Verify that results are external payloads persisted under data/workspaces.",
          conflict: "The product must not hardcode generated results.",
          beats: [
            { type: "action", content: "Validator posts an external result JSON to the workspace API." },
          ],
          adaptation_notes: ["Validation artifact is not committed as a fixture."],
        },
      ],
      adaptation_report: {
        chapter_count: 1,
        scene_count: 1,
        character_count: 1,
        main_conflicts: ["Generic workflow versus hardcoded demo output"],
        omitted_or_compressed: [],
        revision_suggestions: ["Keep generation output outside source code."],
      },
    },
  };
}

async function cleanupWorkspace(id) {
  if (!id || !/^ws_[0-9]{14}_[a-z0-9]{6}$/.test(id)) return;
  const indexPath = path.join(root, "data/workspaces/index.json");
  await rm(path.join(root, "data/workspaces", id), { recursive: true, force: true });
  try {
    const entries = JSON.parse(await readFile(indexPath, "utf8"));
    const nextEntries = Array.isArray(entries) ? entries.filter((entry) => entry?.id !== id) : entries;
    await writeFile(indexPath, `${JSON.stringify(nextEntries, null, 2)}\n`, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function runStaticChecks() {
  for (const relativePath of mustNotExist) {
    assert(!(await exists(relativePath)), `${relativePath} must not exist`);
  }

  const sampleText = await readFile(path.join(root, "samples/novels/journey_to_the_west_gutenberg_23962.txt"), "utf8");
  assert(sampleText.includes("Project Gutenberg"), "public-domain sample must retain Project Gutenberg source text");
  assert(sampleText.includes("第一回"), "public-domain sample must contain chapter headings");

  const sources = await Promise.all(sourceFiles.map(async (relativePath) => [relativePath, await readFile(path.join(root, relativePath), "utf8")]));
  for (const [relativePath, content] of sources) {
    for (const pattern of bannedSourcePatterns) {
      assert(!pattern.test(content), `${relativePath} contains banned fixture artifact ${pattern}`);
    }
  }

  const workspaceDataSource = sources.find(([relativePath]) => relativePath === "src/lib/workspace-data.ts")?.[1] ?? "";
  assert(workspaceDataSource.includes("data") && workspaceDataSource.includes("workspaces"), "workspace storage must target data/workspaces");
  assert(workspaceDataSource.includes("writeJsonAtomic"), "workspace storage should write JSON atomically");
  assert(workspaceDataSource.includes("saveWorkspaceResult"), "workspace storage must save reloadable results");
  assert(workspaceDataSource.includes("path.relative"), "workspace storage must reject path traversal without prefix false positives");

  const workbenchSource = [
    sources.find(([relativePath]) => relativePath === "src/app/page.tsx")?.[1] ?? "",
    sources.find(([relativePath]) => relativePath === "src/components/workbench/WorkbenchShell.tsx")?.[1] ?? "",
  ].join("\n");
  assert(workbenchSource.includes("/api/workspaces"), "workbench must call workspace API");
  assert(workbenchSource.includes("/api/samples/public-domain-novel"), "workbench must load source sample through API");
  assert(workbenchSource.includes("resultText"), "workbench must accept external result JSON instead of hardcoding one");
}

async function runApiChecks(base) {
  let createdWorkspaceId = "";
  try {
    const badPost = await fetchJson(base, "/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[]",
    });
    assert(badPost.response.status === 400, `array POST body must be rejected, got ${badPost.response.status}`);

    const unsafeId = await fetchJson(base, "/api/workspaces/..%2Findex", { method: "GET" });
    assert(unsafeId.response.status === 400 || unsafeId.response.status === 404, `unsafe workspace id must not load data, got ${unsafeId.response.status}`);

    const sample = await fetchJson(base, "/api/samples/public-domain-novel");
    assert(sample.response.status === 200, `sample endpoint returned ${sample.response.status}`);
    assert(typeof sample.data?.chapterText === "string" && sample.data.chapterText.includes("第一回"), "sample endpoint must return source chapter text");

    const create = await fetchJson(base, "/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "M1 API validation workspace",
        rawText: sample.data.chapterText,
        target: { format: "short_drama", genre: "validation", target_duration_minutes: 1, tone: "neutral" },
      }),
    });
    assert(create.response.status === 201, `workspace create returned ${create.response.status}: ${JSON.stringify(create.data)}`);
    createdWorkspaceId = create.data?.id ?? "";
    assert(/^ws_[0-9]{14}_[a-z0-9]{6}$/.test(createdWorkspaceId), "created workspace id must be safe and generated");
    assert(create.data?.result === null, "new workspace should not contain a hardcoded generation result");
    assert(create.data?.request_path === `${createdWorkspaceId}/request.json`, "request must be persisted under data/workspaces/<id>");

    const invalidResult = await fetchJson(base, `/api/workspaces/${createdWorkspaceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: { script: { schema_version: "1.0", title: "invalid", characters: [], locations: [], scenes: [] } } }),
    });
    assert(invalidResult.response.status === 400, `incomplete result must be rejected, got ${invalidResult.response.status}`);

    const save = await fetchJson(base, `/api/workspaces/${createdWorkspaceId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: buildValidationDocument() }),
    });
    assert(save.response.status === 200, `workspace result save returned ${save.response.status}: ${JSON.stringify(save.data)}`);
    assert(save.data?.result_path === `${createdWorkspaceId}/result.json`, "result must be persisted under data/workspaces/<id>");
    assert(save.data?.result?.script?.title === "M1 API validation result", "saved external result must be returned by save response");

    const reload = await fetchJson(base, `/api/workspaces/${createdWorkspaceId}`, { method: "GET" });
    assert(reload.response.status === 200, `workspace reload returned ${reload.response.status}`);
    assert(reload.data?.result?.script?.title === "M1 API validation result", "workspace reload must return externally saved result JSON");
  } finally {
    await cleanupWorkspace(createdWorkspaceId);
  }
}

await runStaticChecks();
const apiBase = apiBaseFromArgs();
if (apiBase) {
  await runApiChecks(apiBase);
  console.log(`M1 generic workflow checks passed (static + API ${apiBase})`);
} else {
  console.log("M1 generic workflow checks passed (static; pass --api http://localhost:3000 for live API checks)");
}
