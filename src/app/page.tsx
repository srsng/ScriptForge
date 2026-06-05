"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeRawNovelInput } from "@/lib/input";
import type { GenerationRequest, InputNormalizationResult, ScriptForgeDocument } from "@/types/scriptforge";

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
                  <p className="text-sm text-zinc-600">{activeWorkspace ? `当前工作区 ${activeWorkspace.id}` : "未选择工作区"}</p>
                </div>
                <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={!activeWorkspace || resultText.trim().length === 0} onClick={() => void saveResult()} type="button">
                  保存结果
                </button>
              </div>
              <textarea
                className="min-h-[260px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
                onChange={(event) => setResultText(event.target.value)}
                placeholder="粘贴 ScriptForgeDocument JSON。保存后写入 data/workspaces/<id>/result.json。"
                spellCheck={false}
                value={resultText}
              />
              <div className="border-t border-zinc-200 px-4 py-3 text-sm text-zinc-600">{hasResult ? "结果已加载，可编辑后重新保存" : "结果为空，等待后续生成模块写入"}</div>
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
