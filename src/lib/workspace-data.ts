import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRawNovelInput } from "@/lib/input";
import type { GenerationRequest, InputNormalizationResult, ScriptForgeDocument, WorkspaceResultSource, WorkspaceState } from "@/types/scriptforge";

const DATA_ROOT = path.join(process.cwd(), "data", "workspaces");
const INDEX_FILE = path.join(DATA_ROOT, "index.json");
const WORKSPACE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{5,79}$/;

export type WorkspaceIndexEntry = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  state_path: string;
};

export type WorkspaceRecord = WorkspaceIndexEntry & {
  request: GenerationRequest;
  chapterText: string;
  normalization: InputNormalizationResult;
  result: ScriptForgeDocument | null;
  state: WorkspaceState;
};

export type CreateWorkspaceInput = {
  state?: unknown;
};

export type SaveWorkspaceStateInput = {
  state: unknown;
};

export type WorkspaceWriteResult =
  | { ok: true; workspace: WorkspaceRecord }
  | { ok: false; status: number; error: string; normalization?: InputNormalizationResult };

function workspaceDir(id: string): string {
  return path.join(DATA_ROOT, id);
}

function dataPath(relativePath: string): string {
  const root = path.resolve(DATA_ROOT);
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("工作区文件路径异常，请返回列表重新打开。");
  }
  return resolved;
}

function assertSafeWorkspaceId(id: string): void {
  if (!WORKSPACE_ID_PATTERN.test(id)) {
    throw new Error("工作区地址不正确，请返回列表重新打开。");
  }
}

async function ensureDataRoot(): Promise<void> {
  await mkdir(DATA_ROOT, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tempPath, filePath);
}

async function readIndex(): Promise<WorkspaceIndexEntry[]> {
  await ensureDataRoot();
  try {
    return await readJsonFile<WorkspaceIndexEntry[]>(INDEX_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeIndex(entries: WorkspaceIndexEntry[]): Promise<void> {
  const sorted = entries.toSorted((a, b) => b.updated_at.localeCompare(a.updated_at));
  await writeJsonAtomic(INDEX_FILE, sorted);
}

function createWorkspaceId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `ws_${stamp}_${suffix}`;
}

function normalizeResultSource(value: unknown): WorkspaceResultSource {
  return value === "ai" || value === "ai_draft" || value === "repair" || value === "manual" || value === "none"
    ? value
    : "none";
}

function validateScriptForgeDocument(value: unknown): ScriptForgeDocument | null {
  if (!value || typeof value !== "object") return null;

  const doc = value as Partial<ScriptForgeDocument>;
  const script = doc.script;
  if (!script || typeof script !== "object") return null;

  if (
    typeof script.title !== "string" ||
    script.schema_version !== "1.1" ||
    !Array.isArray(script.characters) ||
    !Array.isArray(script.locations) ||
    !Array.isArray(script.scenes)
  ) {
    return null;
  }

  return value as ScriptForgeDocument;
}

function buildRestoredGenerationStagePreviews(result: ScriptForgeDocument): unknown[] {
  const chapters = result.script.source.chapters;
  const factCount = chapters.reduce((sum, chapter) => sum + chapter.key_facts.length, 0);
  const scenes = result.script.scenes;
  const beatCount = scenes.reduce((sum, scene) => sum + scene.beats.length, 0);

  return [
    {
      stage: "analyzer",
      label: "梳理原文",
      summary: `${chapters.length} 章素材，${factCount} 条关键信息`,
      json: JSON.stringify(result.script.source, null, 2),
    },
    {
      stage: "planner",
      label: "规划场景",
      summary: `${result.script.characters.length} 个人物，${result.script.locations.length} 个地点，${scenes.length} 个场景安排`,
      json: JSON.stringify({
        characters: result.script.characters,
        locations: result.script.locations,
        scenes: scenes.map((scene) => scene.scene_card),
      }, null, 2),
    },
    {
      stage: "screenwriter",
      label: "撰写剧本",
      summary: `${scenes.length} 个场景，${beatCount} 段剧本内容`,
      json: JSON.stringify({ scenes }, null, 2),
    },
    {
      stage: "reporter",
      label: "整理改编说明",
      summary: `${result.script.adaptation_report.revision_suggestions.length} 条打磨建议`,
      json: JSON.stringify({
        title: result.script.title,
        logline: result.script.metadata.logline,
        adaptation_report: result.script.adaptation_report,
      }, null, 2),
    },
  ];
}

function normalizeWorkspaceState(input: unknown, now = new Date().toISOString()): WorkspaceState | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;

  const candidate = input as Record<string, unknown>;
  const request = candidate.request && typeof candidate.request === "object"
    ? candidate.request as GenerationRequest
    : null;
  if (!request || !Array.isArray(request.chapters)) return null;

  const rawText = typeof candidate.rawText === "string"
    ? candidate.rawText
    : request.chapters.map((chapter) => `# ${chapter.title}\n${chapter.content.trim()}`).join("\n\n");
  const normalization = normalizeRawNovelInput(rawText);
  if (!normalization.isValid) return null;

  const result = candidate.result === null || candidate.result === undefined
    ? null
    : validateScriptForgeDocument(candidate.result);
  if (candidate.result !== null && candidate.result !== undefined && !result) return null;
  const savedGenerationStagePreviews = Array.isArray(candidate.generationStagePreviews) ? candidate.generationStagePreviews : [];
  const generationStagePreviews = savedGenerationStagePreviews.length > 0
    ? savedGenerationStagePreviews
    : result
      ? buildRestoredGenerationStagePreviews(result)
      : [];

  return {
    schema_version: "1.1",
    title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title.trim() : request.chapters[0]?.title ?? "Untitled workspace",
    rawText,
    request,
    result,
    resultSource: normalizeResultSource(candidate.resultSource),
    yamlText: typeof candidate.yamlText === "string" ? candidate.yamlText : "",
    lastAppliedYamlText: typeof candidate.lastAppliedYamlText === "string" ? candidate.lastAppliedYamlText : typeof candidate.yamlText === "string" ? candidate.yamlText : "",
    yamlValidation: candidate.yamlValidation ?? null,
    repairResult: candidate.repairResult ?? null,
    generationDiagnostics: Array.isArray(candidate.generationDiagnostics) ? candidate.generationDiagnostics : [],
    generationStagePreviews,
    generationError: typeof candidate.generationError === "string" ? candidate.generationError : "",
    message: typeof candidate.message === "string" ? candidate.message : "已恢复工作区",
    updated_at: now,
  };
}

async function upsertEntry(entry: WorkspaceIndexEntry): Promise<void> {
  const entries = await readIndex();
  const nextEntries = [entry, ...entries.filter((item) => item.id !== entry.id)];
  await writeIndex(nextEntries);
}

function workspaceRecordFromEntry(entry: WorkspaceIndexEntry, state: WorkspaceState): WorkspaceRecord {
  return {
    ...entry,
    request: state.request,
    chapterText: state.rawText,
    normalization: normalizeRawNovelInput(state.rawText),
    result: state.result,
    state,
  };
}

export async function listWorkspaces(): Promise<WorkspaceIndexEntry[]> {
  return readIndex();
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceWriteResult> {
  const now = new Date().toISOString();
  const state = normalizeWorkspaceState(input.state, now);
  if (!state) {
    return { ok: false, status: 400, error: "请至少载入三章有效小说内容后再保存工作区。" };
  }

  const id = createWorkspaceId();
  const statePath = `${id}/state.json`;
  const entry: WorkspaceIndexEntry = {
    id,
    title: state.title,
    created_at: now,
    updated_at: now,
    chapter_count: state.request.chapters.length,
    state_path: statePath,
  };

  await writeJsonAtomic(path.join(workspaceDir(id), "state.json"), state);
  await upsertEntry(entry);
  return { ok: true, workspace: workspaceRecordFromEntry(entry, state) };
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  assertSafeWorkspaceId(id);
  const entries = await readIndex();
  const entry = entries.find((item) => item.id === id);
  if (!entry) return null;

  const state = normalizeWorkspaceState(
    await readJsonFile<WorkspaceState>(dataPath(entry.state_path)),
    entry.updated_at,
  );
  if (!state) {
    throw new Error("Workspace state is invalid.");
  }

  return workspaceRecordFromEntry(entry, state);
}

export async function saveWorkspaceState(id: string, input: SaveWorkspaceStateInput): Promise<WorkspaceWriteResult> {
  assertSafeWorkspaceId(id);
  const entries = await readIndex();
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    return { ok: false, status: 404, error: "没有找到这个工作区，请返回列表重新打开。" };
  }

  const now = new Date().toISOString();
  const state = normalizeWorkspaceState(input.state, now);
  if (!state) {
    return { ok: false, status: 400, error: "请至少载入三章有效小说内容后再保存工作区。" };
  }

  const nextEntry: WorkspaceIndexEntry = {
    ...entry,
    title: state.title,
    updated_at: now,
    chapter_count: state.request.chapters.length,
    state_path: `${id}/state.json`,
  };

  await writeJsonAtomic(path.join(workspaceDir(id), "state.json"), state);
  await upsertEntry(nextEntry);
  return { ok: true, workspace: workspaceRecordFromEntry(nextEntry, state) };
}

export const workspaceDataRoot = DATA_ROOT;
