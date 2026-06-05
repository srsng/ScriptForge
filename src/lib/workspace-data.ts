import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { chaptersToPlainText, normalizeRawNovelInput } from "@/lib/input";
import type { GenerationRequest, InputNormalizationResult, ScriptForgeDocument } from "@/types/scriptforge";

const DATA_ROOT = path.join(process.cwd(), "data", "workspaces");
const INDEX_FILE = path.join(DATA_ROOT, "index.json");
const WORKSPACE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{5,79}$/;

export type WorkspaceIndexEntry = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  request_path: string;
  result_path?: string;
};

export type WorkspaceRecord = WorkspaceIndexEntry & {
  request: GenerationRequest;
  chapterText: string;
  normalization: InputNormalizationResult;
  result: ScriptForgeDocument | null;
};

export type CreateWorkspaceInput = {
  title?: string;
  rawText: string;
  target?: Partial<GenerationRequest["target"]>;
  result?: unknown;
};

export type SaveWorkspaceResultInput = {
  result: unknown;
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
    throw new Error(`Unsafe workspace path: ${relativePath}`);
  }
  return resolved;
}

function assertSafeWorkspaceId(id: string): void {
  if (!WORKSPACE_ID_PATTERN.test(id)) {
    throw new Error("Invalid workspace id");
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

function defaultTarget(target?: Partial<GenerationRequest["target"]>): GenerationRequest["target"] {
  return {
    format: target?.format ?? "short_drama",
    genre: target?.genre?.trim() || "未指定",
    target_duration_minutes: target?.target_duration_minutes ?? 12,
    tone: target?.tone?.trim() || "未指定",
  };
}

function validateScriptForgeDocument(value: unknown): ScriptForgeDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const doc = value as Partial<ScriptForgeDocument>;
  const script = doc.script;
  if (!script || typeof script !== "object") {
    return null;
  }

  if (
    typeof script.title !== "string" ||
    script.schema_version !== "1.0" ||
    !Array.isArray(script.characters) ||
    !Array.isArray(script.locations) ||
    !Array.isArray(script.scenes)
  ) {
    return null;
  }

  return value as ScriptForgeDocument;
}

async function upsertEntry(entry: WorkspaceIndexEntry): Promise<void> {
  const entries = await readIndex();
  const nextEntries = [entry, ...entries.filter((item) => item.id !== entry.id)];
  await writeIndex(nextEntries);
}

export async function listWorkspaces(): Promise<WorkspaceIndexEntry[]> {
  return readIndex();
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceWriteResult> {
  const rawText = typeof input.rawText === "string" ? input.rawText : "";
  const normalization = normalizeRawNovelInput(rawText);

  if (!normalization.isValid) {
    return {
      ok: false,
      status: 400,
      error: "Input must contain at least three valid chapters before a workspace can be saved.",
      normalization,
    };
  }

  const now = new Date().toISOString();
  const id = createWorkspaceId();
  const request: GenerationRequest = {
    chapters: normalization.chapters,
    target: defaultTarget(input.target),
  };
  const result = input.result === undefined ? null : validateScriptForgeDocument(input.result);

  if (input.result !== undefined && !result) {
    return { ok: false, status: 400, error: "Result must be a ScriptForgeDocument with script.schema_version === '1.0'." };
  }

  const dir = workspaceDir(id);
  const requestPath = `${id}/request.json`;
  const resultPath = result ? `${id}/result.json` : undefined;
  await mkdir(dir, { recursive: true });
  await writeJsonAtomic(path.join(dir, "request.json"), request);
  if (result) {
    await writeJsonAtomic(path.join(dir, "result.json"), result);
  }

  const entry: WorkspaceIndexEntry = {
    id,
    title: input.title?.trim() || request.chapters[0]?.title || "Untitled workspace",
    created_at: now,
    updated_at: now,
    chapter_count: request.chapters.length,
    request_path: requestPath,
    result_path: resultPath,
  };

  await upsertEntry(entry);
  return { ok: true, workspace: await getWorkspace(id) as WorkspaceRecord };
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  assertSafeWorkspaceId(id);
  const entries = await readIndex();
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    return null;
  }

  const request = await readJsonFile<GenerationRequest>(dataPath(entry.request_path));
  let result: ScriptForgeDocument | null = null;
  if (entry.result_path) {
    try {
      result = await readJsonFile<ScriptForgeDocument>(dataPath(entry.result_path));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  const chapterText = chaptersToPlainText(request.chapters);
  return {
    ...entry,
    request,
    chapterText,
    normalization: normalizeRawNovelInput(chapterText),
    result,
  };
}

export async function saveWorkspaceResult(id: string, input: SaveWorkspaceResultInput): Promise<WorkspaceWriteResult> {
  assertSafeWorkspaceId(id);
  const result = validateScriptForgeDocument(input.result);
  if (!result) {
    return { ok: false, status: 400, error: "Result must be a ScriptForgeDocument with script.schema_version === '1.0'." };
  }

  const entries = await readIndex();
  const entry = entries.find((item) => item.id === id);
  if (!entry) {
    return { ok: false, status: 404, error: "Workspace not found." };
  }

  const resultPath = `${id}/result.json`;
  await writeJsonAtomic(path.join(workspaceDir(id), "result.json"), result);
  await upsertEntry({ ...entry, updated_at: new Date().toISOString(), result_path: resultPath });
  return { ok: true, workspace: await getWorkspace(id) as WorkspaceRecord };
}

export const workspaceDataRoot = DATA_ROOT;
