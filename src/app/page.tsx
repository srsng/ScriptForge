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

function jsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
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
    <main className="min-h-screen bg-[#f6f6f3] text-[#1f2523]">
      <header className="border-b border-[#d7d4cb] bg-[#fbfaf7]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-sm font-medium text-[#6b5d3d]">ScriptForge</p>
            <h1 className="text-2xl font-semibold tracking-normal">小说输入工作台</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#59635f]">
            <span>{message}</span>
            <button className="border border-[#9da7a0] px-3 py-2 font-medium hover:bg-[#eef0eb]" onClick={() => void refreshWorkspaces()} type="button">
              刷新
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="grid gap-3 border border-[#d7d4cb] bg-white p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="grid gap-1 text-sm font-medium">
              工作区标题
              <input className="border border-[#b9b7ad] px-3 py-2 font-normal outline-none focus:border-[#2c6757]" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              类型
              <input className="border border-[#b9b7ad] px-3 py-2 font-normal outline-none focus:border-[#2c6757]" value={genre} onChange={(event) => setGenre(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              时长（分钟）
              <input className="border border-[#b9b7ad] px-3 py-2 font-normal outline-none focus:border-[#2c6757]" min={1} type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
            </label>
            <label className="grid gap-1 text-sm font-medium md:col-span-3">
              语气
              <input className="border border-[#b9b7ad] px-3 py-2 font-normal outline-none focus:border-[#2c6757]" value={tone} onChange={(event) => setTone(event.target.value)} />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="border border-[#d7d4cb] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7d4cb] px-4 py-3">
                <h2 className="text-base font-semibold">章节输入</h2>
                <div className="flex gap-2">
                  <button className="border border-[#9da7a0] px-3 py-2 text-sm font-medium hover:bg-[#eef0eb]" onClick={() => void loadPublicDomainSample()} type="button">
                    载入公开样本
                  </button>
                  <button className="bg-[#255f50] px-3 py-2 text-sm font-medium text-white hover:bg-[#1f5144] disabled:bg-[#9da7a0]" disabled={!normalization.isValid || saveState === "saving"} onClick={() => void saveWorkspace()} type="button">
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
              <div className="border border-[#d7d4cb] bg-white p-4">
                <h2 className="text-base font-semibold">输入状态</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="border border-[#d7d4cb] p-3">
                    <div className="text-2xl font-semibold">{normalization.chapters.length}</div>
                    <div className="text-[#59635f]">章节</div>
                  </div>
                  <div className="border border-[#d7d4cb] p-3">
                    <div className="text-2xl font-semibold">{normalization.isValid ? "OK" : "NO"}</div>
                    <div className="text-[#59635f]">可保存</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  {normalization.issues.length === 0 ? <p className="text-[#2c6757]">未发现输入问题</p> : null}
                  {normalization.issues.map((issue) => (
                    <p className={issue.severity === "error" ? "text-[#9b3328]" : "text-[#8a6418]"} key={`${issue.path}-${issue.code}`}>
                      {issue.message}
                    </p>
                  ))}
                </div>
              </div>

              <div className="border border-[#d7d4cb] bg-white p-4">
                <h2 className="text-base font-semibold">章节列表</h2>
                <div className="mt-3 max-h-[260px] space-y-2 overflow-auto text-sm">
                  {normalization.chapters.map((chapter) => (
                    <div className="border border-[#e1ded6] p-2" key={chapter.id}>
                      <div className="font-medium">{chapter.title}</div>
                      <div className="text-[#59635f]">{chapter.content.length} 字符</div>
                    </div>
                  ))}
                </div>
              </div>

              {sampleMeta ? (
                <div className="border border-[#d7d4cb] bg-white p-4 text-sm">
                  <h2 className="text-base font-semibold">样本来源</h2>
                  <p className="mt-2">{sampleMeta.title}</p>
                  <p className="text-[#59635f]">{sampleMeta.author}</p>
                  <a className="break-all text-[#255f50] underline" href={sampleMeta.source} rel="noreferrer" target="_blank">
                    {sampleMeta.source}
                  </a>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="border border-[#d7d4cb] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7d4cb] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">结果 JSON</h2>
                <p className="text-sm text-[#59635f]">{activeWorkspace ? `当前工作区 ${activeWorkspace.id}` : "未选择工作区"}</p>
              </div>
              <button className="bg-[#255f50] px-3 py-2 text-sm font-medium text-white hover:bg-[#1f5144] disabled:bg-[#9da7a0]" disabled={!activeWorkspace || resultText.trim().length === 0} onClick={() => void saveResult()} type="button">
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
            <div className="border-t border-[#d7d4cb] px-4 py-3 text-sm text-[#59635f]">{hasResult ? "结果已加载，可编辑后重新保存" : "结果为空，等待后续生成模块写入"}</div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="border border-[#d7d4cb] bg-white p-4">
            <h2 className="text-base font-semibold">已保存工作区</h2>
            <div className="mt-3 max-h-[720px] space-y-2 overflow-auto">
              {workspaces.length === 0 ? <p className="text-sm text-[#59635f]">暂无保存记录</p> : null}
              {workspaces.map((workspace) => (
                <button
                  className="w-full border border-[#d7d4cb] p-3 text-left hover:border-[#255f50] hover:bg-[#f3f7f4]"
                  key={workspace.id}
                  onClick={() => void loadWorkspace(workspace.id)}
                  type="button"
                >
                  <div className="font-medium">{workspace.title}</div>
                  <div className="mt-1 text-sm text-[#59635f]">{workspace.chapter_count} 章 · {formatDate(workspace.updated_at)}</div>
                  <div className="mt-1 text-xs text-[#59635f]">{workspace.result_path ? "已有结果" : "仅输入"}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
