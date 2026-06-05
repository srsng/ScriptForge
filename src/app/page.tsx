"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeRawNovelInput } from "@/lib/input";
import type { GenerationRequest, InputNormalizationResult, ScriptForgeDocument } from "@/types/scriptforge";
import {
  documentToYaml,
  documentToJson,
  documentToMarkdown,
  generateYamlFilename,
  generateJsonFilename,
  generateMarkdownFilename,
} from "@/lib/yaml";
import type { ValidationResult } from "@/lib/schema";

type WorkspaceIndexEntry = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  request_path: string;
  result_path?: string;
};

type WorkspaceRecord = WorkspaceIndexEntry & {
  request: GenerationRequest;
  chapterText: string;
  normalization: InputNormalizationResult;
  result: ScriptForgeDocument | null;
};

type SampleResponse = {
  title: string;
  author: string;
  source: string;
  license_note: string;
  chapterText: string;
  normalization: InputNormalizationResult;
  request: GenerationRequest;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type GenerateState = "idle" | "loading" | "done" | "error";

type GenerateDiagnostic = {
  stage: string;
  message: string;
  severity?: "info" | "warning" | "error";
};

type GenerateResponse = {
  document?: ScriptForgeDocument;
  scriptYaml?: string;
  diagnostics?: GenerateDiagnostic[];
  usedFallback?: boolean;
  workspaceId?: string;
  error?: string;
};

const EMPTY_RESULT_TEXT = "";

const workflowStages = [
  "章节输入",
  "改编偏好",
  "工作区持久化",
  "外部结果导入",
  "Schema 校验保存",
  "预览 / 导出接入",
] as const;

const contractFields = ["chapters", "target.format", "target.genre", "target.tone", "target_duration_minutes"] as const;

function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function FieldPill({ children }: { children: string }) {
  return (
    <div className="min-h-10 break-words rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-600">
      {children}
    </div>
  );
}

export default function Home() {
  const [rawInput, setRawInput] = useState("");
  const [title, setTitle] = useState("新建小说改编工作区");
  const [genre, setGenre] = useState("未指定");
  const [tone, setTone] = useState("未指定");
  const [duration, setDuration] = useState(12);
  const [workspaces, setWorkspaces] = useState<WorkspaceIndexEntry[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [resultText, setResultText] = useState(EMPTY_RESULT_TEXT);
  const [sampleMeta, setSampleMeta] = useState<Pick<SampleResponse, "title" | "author" | "source" | "license_note"> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("准备输入");
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [generationDiagnostics, setGenerationDiagnostics] = useState<GenerateDiagnostic[]>([]);
  const [generationError, setGenerationError] = useState("");
  // ── M3 YAML export state ──
  const [yamlText, setYamlText] = useState("");
  const [yamlValidation, setYamlValidation] = useState<ValidationResult | null>(null);
  const [yamlValidating, setYamlValidating] = useState(false);

  const normalization = useMemo(() => normalizeRawNovelInput(rawInput), [rawInput]);
  const hasResult = activeWorkspace?.result !== null && activeWorkspace?.result !== undefined;

  async function fetchWorkspaceList() {
    const response = await fetch("/api/workspaces");
    const data = (await response.json()) as { workspaces: WorkspaceIndexEntry[] };
    return data.workspaces;
  }

  async function refreshWorkspaces() {
    setWorkspaces(await fetchWorkspaceList());
  }

  useEffect(() => {
    void fetchWorkspaceList().then((entries) => setWorkspaces(entries));
  }, []);

  async function loadPublicDomainSample() {
    setMessage("正在载入样本");
    const response = await fetch("/api/samples/public-domain-novel");
    const sample = (await response.json()) as SampleResponse;
    setRawInput(sample.chapterText);
    setTitle(sample.title);
    setGenre(sample.request.target.genre);
    setTone(sample.request.target.tone);
    setDuration(sample.request.target.target_duration_minutes);
    setSampleMeta({ title: sample.title, author: sample.author, source: sample.source, license_note: sample.license_note });
    setMessage(`已载入 ${sample.normalization.chapters.length} 章公开来源样本`);
  }

  async function saveWorkspace() {
    setSaveState("saving");
    setMessage("正在保存工作区");
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        rawText: rawInput,
        target: {
          format: "short_drama",
          genre,
          tone,
          target_duration_minutes: duration,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSaveState("error");
      setMessage(data.error ?? "保存失败");
      return;
    }

    const workspace = data as WorkspaceRecord;
    setActiveWorkspace(workspace);
    setResultText(workspace.result ? jsonPreview(workspace.result) : EMPTY_RESULT_TEXT);
    await refreshWorkspaces();
    setSaveState("saved");
    setMessage(`已保存 ${workspace.id}`);
  }

  async function loadWorkspace(id: string) {
    setMessage("正在加载工作区");
    const response = await fetch(`/api/workspaces/${encodeURIComponent(id)}`);
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "加载失败");
      return;
    }

    const workspace = data as WorkspaceRecord;
    setActiveWorkspace(workspace);
    setRawInput(workspace.chapterText);
    setTitle(workspace.title);
    setGenre(workspace.request.target.genre);
    setTone(workspace.request.target.tone);
    setDuration(workspace.request.target.target_duration_minutes);
    setResultText(workspace.result ? jsonPreview(workspace.result) : EMPTY_RESULT_TEXT);
    setMessage(`已加载 ${workspace.id}`);
  }

  async function saveResult() {
    if (!activeWorkspace) {
      setMessage("请先保存或加载工作区");
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(resultText);
    } catch {
      setMessage("结果 JSON 格式无效");
      return;
    }

    setMessage("正在保存结果");
    const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspace.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: parsed }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "结果保存失败");
      return;
    }

    const workspace = data as WorkspaceRecord;
    setActiveWorkspace(workspace);
    setResultText(workspace.result ? jsonPreview(workspace.result) : EMPTY_RESULT_TEXT);
    await refreshWorkspaces();
    setMessage(`结果已保存到 data/workspaces/${workspace.id}/result.json`);
  }

  async function generateDraft() {
    setGenerateState("loading");
    setGenerationError("");
    setGenerationDiagnostics([]);
    setMessage("正在生成剧本初稿");

    const payload = activeWorkspace
      ? { workspaceId: activeWorkspace.id, persist: true }
      : {
          sourceText: rawInput,
          target: {
            format: "short_drama",
            genre,
            tone,
            target_duration_minutes: duration,
            logline: "自动从输入章节提炼核心冲突。",
          },
        };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as GenerateResponse;
      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "AI 生成失败");
      }

      setResultText(jsonPreview(data.document));
      setYamlText(data.scriptYaml ?? documentToYaml(data.document));
      setYamlValidation(null);
      setGenerationDiagnostics(data.diagnostics ?? []);
      setGenerateState("done");
      if (activeWorkspace) {
        setActiveWorkspace({
          ...activeWorkspace,
          result: data.document,
          result_path: activeWorkspace.result_path ?? `${activeWorkspace.id}/result.json`,
          updated_at: new Date().toISOString(),
        });
        await refreshWorkspaces();
      }
      setMessage(data.usedFallback ? "已生成可校验降级剧本初稿" : "已生成剧本初稿");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(errorMessage);
      setGenerateState("error");
      setMessage(errorMessage);
    }
  }

  // ── M3 YAML export functions ────────────────────────────────────────────

  function parseResultText(): ScriptForgeDocument | null {
    if (!resultText.trim()) return null;
    try {
      const parsed = JSON.parse(resultText) as unknown;
      if (parsed && typeof parsed === "object") {
        const doc = parsed as Record<string, unknown>;
        // Accept both {script:{...}} and top-level script
        if (doc.script && typeof doc.script === "object") {
          return doc as unknown as ScriptForgeDocument;
        }
        if (doc.schema_version === "1.0") {
          return { script: doc as unknown as ScriptForgeDocument["script"] };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  function handleConvertToYaml() {
    const doc = parseResultText();
    if (!doc) {
      setMessage("结果 JSON 不是有效的 ScriptForgeDocument，无法导出");
      return;
    }
    const yaml = documentToYaml(doc);
    setYamlText(yaml);
    setYamlValidation(null);
    setMessage("已生成 YAML，可编辑后重新校验或直接导出");
  }

  async function handleYamlRevalidate() {
    if (!yamlText.trim()) {
      setMessage("YAML 内容为空，无法校验");
      return;
    }
    setYamlValidating(true);
    setMessage("正在校验 YAML...");
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamlText }),
      });
      const result = (await response.json()) as ValidationResult;
      setYamlValidation(result);
      if (result.valid) {
        setMessage("YAML 校验通过，可以导出");
      } else if (result.status === "warn") {
        setMessage(`YAML 校验通过但存在 ${result.warnings.length} 条警告`);
      } else {
        setMessage(`YAML 校验失败：${result.errors.length} 条错误`);
      }
    } catch {
      setMessage("YAML 校验请求失败");
      setYamlValidation(null);
    } finally {
      setYamlValidating(false);
    }
  }

  function handleDownload(format: "yaml" | "json" | "markdown") {
    const doc = parseResultText();
    if (!doc) {
      setMessage("无法导出：结果 JSON 不是有效的 ScriptForgeDocument");
      return;
    }

    // Block export if YAML has been edited and validation failed
    if (format === "yaml" && yamlValidation && !yamlValidation.valid) {
      setMessage("导出已阻止：YAML 校验未通过，请先修复错误");
      return;
    }

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case "yaml":
        content = yamlText || documentToYaml(doc);
        filename = generateYamlFilename(doc.script.title);
        mimeType = "application/x-yaml";
        break;
      case "json":
        content = documentToJson(doc);
        filename = generateJsonFilename(doc.script.title);
        mimeType = "application/json";
        break;
      case "markdown":
        content = documentToMarkdown(doc);
        filename = generateMarkdownFilename(doc.script.title);
        mimeType = "text/markdown";
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage(`${format.toUpperCase()} 已下载：${filename}`);
  }

  async function handleCopyYaml() {
    const doc = parseResultText();
    if (!doc) {
      setMessage("无法复制：结果 JSON 不是有效的 ScriptForgeDocument");
      return;
    }
    const yaml = yamlText || documentToYaml(doc);
    try {
      await navigator.clipboard.writeText(yaml);
      setMessage("YAML 已复制到剪贴板");
    } catch {
      setMessage("复制失败，请手动选择文本复制");
    }
  }

  const canExport = parseResultText() !== null;
  const yamlExportBlocked = yamlValidation !== null && !yamlValidation.valid;

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-700">ScriptForge M1</p>
              <h1 className="mt-1 text-3xl font-semibold text-zinc-950">小说输入工作台</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                载入公开来源章节，标准化 NovelChapter[] 与 GenerationRequest，并把输入工作区持久化到 data/workspaces。结果区只接收外部
                ScriptForgeDocument JSON，不再内置生成成片。
              </p>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[34rem]">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Input</p>
                <p className="mt-1 text-zinc-600">公开文本 / 手动粘贴</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Storage</p>
                <p className="mt-1 text-zinc-600">data/workspaces</p>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-950">Status</p>
                <p className="mt-1 text-emerald-700">{message}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">改编请求</h2>
                  <p className="text-sm text-zinc-600">配置目标格式、类型、语气与时长；章节正文可来自接口样本或人工输入。</p>
                </div>
                <button className="rounded-md border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50" onClick={() => void refreshWorkspaces()} type="button">
                  刷新工作区
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                <label className="grid gap-1 text-sm font-medium">
                  标题
                  <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  类型
                  <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={genre} onChange={(event) => setGenre(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  时长（分钟）
                  <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" min={1} type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
                </label>
                <label className="grid gap-1 text-sm font-medium md:col-span-3">
                  语气
                  <input className="rounded-md border border-zinc-300 px-3 py-2 font-normal outline-none focus:border-cyan-700" value={tone} onChange={(event) => setTone(event.target.value)} />
                </label>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                  <div>
                    <h2 className="text-lg font-semibold">章节输入</h2>
                    <p className="text-sm text-zinc-600">至少 3 章；支持 第一章、第一回、Chapter 1、1. 标题。</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50" onClick={() => void loadPublicDomainSample()} type="button">
                      载入公开样本
                    </button>
                    <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={!normalization.isValid || saveState === "saving"} onClick={() => void saveWorkspace()} type="button">
                      保存工作区
                    </button>
                  </div>
                </div>
                <textarea
                  className="min-h-[560px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
                  onChange={(event) => setRawInput(event.target.value)}
                  placeholder="粘贴至少 3 个章节。章节标题可用：第一章、第一回、Chapter 1、1. 标题。"
                  spellCheck={false}
                  value={rawInput}
                />
              </div>

              <aside className="space-y-4">
                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">输入状态</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-zinc-200 p-3">
                      <div className="text-2xl font-semibold">{normalization.chapters.length}</div>
                      <div className="text-zinc-600">章节</div>
                    </div>
                    <div className="rounded-md border border-zinc-200 p-3">
                      <div className="text-2xl font-semibold">{normalization.isValid ? "OK" : "NO"}</div>
                      <div className="text-zinc-600">可保存</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {normalization.issues.length === 0 ? <p className="text-emerald-700">未发现输入问题</p> : null}
                    {normalization.issues.map((issue) => (
                      <p className={issue.severity === "error" ? "text-red-700" : "text-amber-700"} key={`${issue.path}-${issue.code}`}>
                        {issue.message}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">GenerationRequest 契约</h2>
                  <div className="mt-3 grid gap-2">
                    {contractFields.map((field) => (
                      <FieldPill key={field}>{field}</FieldPill>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                  <h2 className="text-lg font-semibold">章节列表</h2>
                  <div className="mt-3 max-h-[260px] space-y-2 overflow-auto text-sm">
                    {normalization.chapters.map((chapter) => (
                      <div className="rounded-md border border-zinc-200 p-2" key={chapter.id}>
                        <div className="font-medium">{chapter.title}</div>
                        <div className="text-zinc-600">{chapter.content.length} 字符</div>
                      </div>
                    ))}
                  </div>
                </div>

                {sampleMeta ? (
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm">
                    <h2 className="text-lg font-semibold">样本来源</h2>
                    <p className="mt-2">{sampleMeta.title}</p>
                    <p className="text-zinc-600">{sampleMeta.author}</p>
                    <p className="mt-2 text-zinc-600">{sampleMeta.license_note}</p>
                    <a className="mt-2 block break-all text-cyan-700 underline" href={sampleMeta.source} rel="noreferrer" target="_blank">
                      {sampleMeta.source}
                    </a>
                  </div>
                ) : null}
              </aside>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">结果 JSON</h2>
                  <p className="text-sm text-zinc-600">{activeWorkspace ? `当前工作区 ${activeWorkspace.id}` : "未选择工作区，可直接从输入章节生成"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:bg-zinc-300"
                    disabled={generateState === "loading" || (!activeWorkspace && !normalization.isValid)}
                    onClick={() => void generateDraft()}
                    type="button"
                  >
                    {generateState === "loading" ? "生成中…" : "AI生成剧本初稿"}
                  </button>
                  <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={!activeWorkspace || resultText.trim().length === 0} onClick={() => void saveResult()} type="button">
                    保存结果
                  </button>
                </div>
              </div>
              <textarea
                className="min-h-[260px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
                onChange={(event) => setResultText(event.target.value)}
                placeholder="粘贴 ScriptForgeDocument JSON，或点击 AI生成剧本初稿。保存后写入 data/workspaces/<id>/result.json。"
                spellCheck={false}
                value={resultText}
              />
              {(generationError || generationDiagnostics.length > 0) && (
                <div className="space-y-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
                  {generationError && <p className="font-medium text-red-700">{generationError}</p>}
                  {generationDiagnostics.length > 0 && (
                    <ul className="space-y-1 text-zinc-700">
                      {generationDiagnostics.map((item, index) => (
                        <li key={`${item.stage}-${index}`}>
                          <span className="font-medium">[{item.severity ?? "info"}] {item.stage}</span>：{item.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">{hasResult ? "结果已加载，可编辑后重新保存" : "结果为空，可通过 M4 AI 生成接口写入"}</div>
            </div>

            {/* ── M3 YAML 导出 ── */}
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">M3 · YAML 导出</h2>
                  <p className="text-sm text-zinc-600">将结果转换为稳定字段顺序 YAML，支持编辑、重校验与下载</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="rounded-md border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 disabled:opacity-50"
                    disabled={!canExport}
                    onClick={handleConvertToYaml}
                    type="button"
                  >
                    生成 YAML
                  </button>
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                    disabled={!canExport}
                    onClick={handleCopyYaml}
                    type="button"
                  >
                    复制 YAML
                  </button>
                  <button
                    className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                    disabled={!canExport || yamlExportBlocked}
                    onClick={() => handleDownload("yaml")}
                    type="button"
                  >
                    下载 YAML
                  </button>
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                    disabled={!canExport}
                    onClick={() => handleDownload("json")}
                    type="button"
                  >
                    下载 JSON
                  </button>
                  <button
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                    disabled={!canExport}
                    onClick={() => handleDownload("markdown")}
                    type="button"
                  >
                    下载 MD
                  </button>
                </div>
              </div>
              <textarea
                className="min-h-[200px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
                onChange={(event) => { setYamlText(event.target.value); setYamlValidation(null); }}
                placeholder="点击「生成 YAML」将结果 JSON 转为稳定字段顺序的 YAML。生成后可编辑并重新校验。"
                spellCheck={false}
                value={yamlText}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300"
                    disabled={!yamlText.trim() || yamlValidating}
                    onClick={() => void handleYamlRevalidate()}
                    type="button"
                  >
                    {yamlValidating ? "校验中..." : "重新校验 YAML"}
                  </button>
                  {yamlValidation && (
                    <span className={`text-sm font-medium ${yamlValidation.valid ? (yamlValidation.status === "warn" ? "text-amber-700" : "text-emerald-700") : "text-red-700"}`}>
                      {yamlValidation.status === "pass" && "✅ 校验通过"}
                      {yamlValidation.status === "warn" && `⚠️ 通过 (${yamlValidation.warnings.length} 条警告)`}
                      {yamlValidation.status === "error" && `❌ 失败 (${yamlValidation.errors.length} 条错误)`}
                    </span>
                  )}
                  {yamlExportBlocked && (
                    <span className="text-sm font-medium text-red-700">导出已阻止：请先修复校验错误</span>
                  )}
                </div>
                <span className="text-sm text-zinc-600">
                  {yamlText ? `${yamlText.length} 字符` : "未生成 YAML"}
                </span>
              </div>
              {/* YAML validation errors */}
              {yamlValidation && yamlValidation.errors.length > 0 && (
                <div className="border-t border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm font-medium text-red-800">校验错误：</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-red-700">
                    {yamlValidation.errors.map((err, i) => (
                      <li key={i}><code className="text-xs">{err.path}</code> — {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {yamlValidation && yamlValidation.warnings.length > 0 && (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-medium text-amber-800">警告：</p>
                  <ul className="mt-1 list-inside list-disc text-sm text-amber-700">
                    {yamlValidation.warnings.map((w, i) => (
                      <li key={i}><code className="text-xs">{w.path}</code> — {w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">M1 工作流</h2>
              <div className="mt-4 space-y-2">
                {workflowStages.map((stage, index) => (
                  <div className="flex items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm" key={stage}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-700 text-xs font-semibold text-white">{index + 1}</span>
                    <span>{stage}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">已保存工作区</h2>
              <div className="mt-3 max-h-[760px] space-y-2 overflow-auto">
                {workspaces.length === 0 ? <p className="text-sm text-zinc-600">暂无保存记录</p> : null}
                {workspaces.map((workspace) => (
                  <button
                    className="w-full rounded-md border border-zinc-200 p-3 text-left hover:border-cyan-700 hover:bg-cyan-50"
                    key={workspace.id}
                    onClick={() => void loadWorkspace(workspace.id)}
                    type="button"
                  >
                    <div className="font-medium">{workspace.title}</div>
                    <div className="mt-1 text-sm text-zinc-600">{workspace.chapter_count} 章 · {formatDate(workspace.updated_at)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{workspace.result_path ? "已有结果" : "仅输入"}</div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
