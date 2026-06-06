"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeRawNovelInput } from "@/lib/input";
import {
  documentToJson,
  documentToMarkdown,
  documentToYaml,
  generateJsonFilename,
  generateMarkdownFilename,
  generateYamlFilename,
} from "@/lib/yaml";
import type { ValidationResult } from "@/lib/schema";
import type { RepairResult } from "@/lib/repair";
import type { GenerationDiagnostic } from "@/lib/generation/types";
import type {
  GenerationRequest,
  InputNormalizationResult,
  ScriptForgeDocument,
  ScriptFormat,
  WorkspaceState,
} from "@/types/scriptforge";
import { AdaptationReportPanel } from "./AdaptationReportPanel";
import { GenerationPanel } from "./GenerationPanel";
import { InputPanel } from "./InputPanel";
import { PreferencePanel } from "./PreferencePanel";
import { QualityPanel } from "./QualityPanel";
import { ScriptPreviewPanel } from "./ScriptPreviewPanel";
import { WorkspaceList, type WorkspaceIndexEntry } from "./WorkspaceList";
import { YamlEditorPanel } from "./YamlEditorPanel";
import {
  jsonPreview,
  parseDocumentJson,
  resultSourceLabel,
  type ResultSource,
} from "./utils";

type WorkspaceRecord = WorkspaceIndexEntry & {
  request: GenerationRequest;
  chapterText: string;
  normalization: InputNormalizationResult;
  result: ScriptForgeDocument | null;
  state: WorkspaceState;
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

type GenerateResponse = {
  document?: ScriptForgeDocument;
  scriptYaml?: string;
  validation?: ValidationResult;
  diagnostics?: GenerationDiagnostic[];
  usedFallback?: boolean;
  workspaceId?: string;
  status?: string;
  error?: string;
};

const EMPTY_RESULT_TEXT = "";

export function WorkbenchShell() {
  const [rawInput, setRawInput] = useState("");
  const [title, setTitle] = useState("新建小说改编工作区");
  const [format, setFormat] = useState<ScriptFormat>("short_drama");
  const [genre, setGenre] = useState("未指定");
  const [tone, setTone] = useState("未指定");
  const [duration, setDuration] = useState(12);
  const [workspaces, setWorkspaces] = useState<WorkspaceIndexEntry[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [resultText, setResultText] = useState(EMPTY_RESULT_TEXT);
  const [resultSource, setResultSource] = useState<ResultSource>("none");
  const [sampleMeta, setSampleMeta] = useState<Pick<SampleResponse, "title" | "author" | "source" | "license_note"> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("准备输入");
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [generationDiagnostics, setGenerationDiagnostics] = useState<GenerationDiagnostic[]>([]);
  const [generationError, setGenerationError] = useState("");
  const [yamlText, setYamlText] = useState("");
  const [yamlValidation, setYamlValidation] = useState<ValidationResult | null>(null);
  const [yamlValidating, setYamlValidating] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [hasUnsavedState, setHasUnsavedState] = useState(false);

  const normalization = useMemo(() => normalizeRawNovelInput(rawInput), [rawInput]);
  const currentDocument = useMemo(() => parseDocumentJson(resultText), [resultText]);
  const currentGenerationRequest: GenerationRequest = useMemo(() => ({
    chapters: normalization.chapters,
    target: {
      format,
      genre,
      tone,
      target_duration_minutes: duration,
    },
  }), [duration, format, genre, normalization.chapters, tone]);
  const canGenerate = normalization.isValid && generateState !== "loading";
  const canExport = currentDocument !== null;
  const yamlExportBlocked = yamlValidation !== null && !yamlValidation.valid;

  function buildWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
    return {
      schema_version: "1.0",
      title,
      rawText: rawInput,
      request: currentGenerationRequest,
      result: currentDocument,
      resultSource,
      yamlText,
      yamlValidation,
      repairResult,
      generationDiagnostics,
      generationError,
      message,
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function applyWorkspaceState(state: WorkspaceState) {
    setRawInput(state.rawText);
    setTitle(state.title);
    setFormat(state.request.target.format);
    setGenre(state.request.target.genre);
    setTone(state.request.target.tone);
    setDuration(state.request.target.target_duration_minutes);
    setResultText(state.result ? jsonPreview(state.result) : EMPTY_RESULT_TEXT);
    setYamlText(state.yamlText || (state.result ? documentToYaml(state.result) : ""));
    setYamlValidation(state.yamlValidation as ValidationResult | null);
    setRepairResult(state.repairResult as RepairResult | null);
    setGenerationDiagnostics(state.generationDiagnostics as GenerationDiagnostic[]);
    setGenerationError(state.generationError);
    setResultSource(state.resultSource);
    setMessage(state.message || "已恢复工作区");
    setHasUnsavedState(false);
  }

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
    setFormat(sample.request.target.format);
    setGenre(sample.request.target.genre);
    setTone(sample.request.target.tone);
    setDuration(sample.request.target.target_duration_minutes);
    setSampleMeta({ title: sample.title, author: sample.author, source: sample.source, license_note: sample.license_note });
    setResultText(EMPTY_RESULT_TEXT);
    setYamlText("");
    setYamlValidation(null);
    setRepairResult(null);
    setResultSource("none");
    setHasUnsavedState(true);
    setMessage(`已载入 ${sample.normalization.chapters.length} 章公开来源样本`);
  }

  async function saveWorkspace() {
    setSaveState("saving");
    setMessage("正在保存工作区");
    const state = buildWorkspaceState();
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSaveState("error");
      setMessage(data.error ?? "保存失败");
      return;
    }

    const workspace = data as WorkspaceRecord;
    setActiveWorkspace(workspace);
    applyWorkspaceState(workspace.state);
    await refreshWorkspaces();
    setSaveState("saved");
    setHasUnsavedState(false);
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
    applyWorkspaceState(workspace.state);
    setMessage(`已加载 ${workspace.id}`);
  }

  async function saveCurrentWorkspaceState(overrides: Partial<WorkspaceState> = {}) {
    if (!activeWorkspace) {
      setMessage("请先保存或加载工作区，再保存当前状态");
      return;
    }

    setSaveState("saving");
    const state = buildWorkspaceState(overrides);
    const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspace.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });
    const data = await response.json();
    if (!response.ok) {
      setSaveState("error");
      setMessage(data.error ?? "状态保存失败");
      return;
    }

    const workspace = data as WorkspaceRecord;
    setActiveWorkspace(workspace);
    setSaveState("saved");
    setHasUnsavedState(false);
    await refreshWorkspaces();
    setMessage(`当前状态已保存到 ${workspace.id}`);
  }

  async function generateDraft() {
    setGenerateState("loading");
    setGenerationError("");
    setGenerationDiagnostics([]);
    setRepairResult(null);
    setMessage("正在生成剧本初稿");

    const payload = {
      request: currentGenerationRequest,
      workspaceId: activeWorkspace?.id,
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
      setYamlValidation(data.validation ?? null);
      setGenerationDiagnostics(data.diagnostics ?? []);
      setGenerateState("done");
      setResultSource(data.usedFallback ? "fallback" : "ai");
      if (activeWorkspace) {
        const source = data.usedFallback ? "fallback" : "ai";
        await saveCurrentWorkspaceState({
          result: data.document,
          resultSource: source,
          yamlText: data.scriptYaml ?? documentToYaml(data.document),
          yamlValidation: data.validation ?? null,
          generationDiagnostics: data.diagnostics ?? [],
          generationError: "",
          message: data.usedFallback ? "已生成 fallback 降级剧本初稿" : "已生成 AI 剧本初稿",
        });
      } else {
        setHasUnsavedState(true);
      }
      setMessage(data.usedFallback ? "已生成 fallback 降级剧本初稿" : "已生成 AI 剧本初稿");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(errorMessage);
      setGenerateState("error");
      setMessage(errorMessage);
    }
  }

  function handleResultTextChange(value: string) {
    setResultText(value);
    setYamlValidation(null);
    setRepairResult(null);
    setResultSource(value.trim() ? "manual" : "none");
    setHasUnsavedState(true);
  }

  function handleConvertToYaml() {
    if (!currentDocument) {
      setMessage("结果 JSON 不是有效的 ScriptForgeDocument，无法导出");
      return;
    }

    setYamlText(documentToYaml(currentDocument));
    setYamlValidation(null);
    setHasUnsavedState(true);
    setMessage("已生成 YAML，可编辑后重新校验或直接导出");
  }

  async function handleYamlRevalidate() {
    if (!yamlText.trim()) {
      setMessage("YAML 内容为空，无法校验");
      return;
    }

    setYamlValidating(true);
    setMessage("正在校验 YAML");
    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamlText }),
      });
      const result = (await response.json()) as ValidationResult;
      setYamlValidation(result);
      setHasUnsavedState(true);
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

  async function handleAutoRepair() {
    if (!currentDocument && !yamlText.trim()) {
      setMessage("没有可修复内容：请先生成结果或提供 YAML");
      return;
    }

    setRepairing(true);
    setRepairResult(null);
    setMessage("正在执行自动修复");
    try {
      const payload = yamlText.trim() ? { yamlText } : { document: currentDocument };
      const response = await fetch("/api/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as RepairResult;
      setRepairResult(result);
      setHasUnsavedState(true);

      if (result.status === "ok") {
        setMessage(`自动修复完成：${result.appliedFixes.length} 项修复已应用`);
      } else if (result.status === "partial") {
        setMessage(`部分修复：${result.appliedFixes.length} 项修复已应用`);
      } else {
        setMessage(`自动修复失败：${result.diagnostics.length} 条无法自动修复的错误`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setMessage(`自动修复请求失败：${errorMessage}`);
    } finally {
      setRepairing(false);
    }
  }

  function handleApplyRepair() {
    if (!repairResult?.document) return;

    setResultText(jsonPreview(repairResult.document));
    setYamlText(repairResult.yamlText ?? documentToYaml(repairResult.document));
    setYamlValidation(null);
    setResultSource("repair");
    setRepairResult(null);
    setHasUnsavedState(true);
    setMessage("修复结果已应用，建议重新校验 YAML");
  }

  function handleDownload(formatName: "yaml" | "json" | "markdown") {
    if (!currentDocument) {
      setMessage("无法导出：结果 JSON 不是有效的 ScriptForgeDocument");
      return;
    }

    if (formatName === "yaml" && yamlExportBlocked) {
      setMessage("导出已阻止：YAML 校验未通过，请先修复错误");
      return;
    }

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (formatName) {
      case "yaml":
        content = yamlText || documentToYaml(currentDocument);
        filename = generateYamlFilename(currentDocument.script.title);
        mimeType = "application/x-yaml";
        break;
      case "json":
        content = documentToJson(currentDocument);
        filename = generateJsonFilename(currentDocument.script.title);
        mimeType = "application/json";
        break;
      case "markdown":
        content = documentToMarkdown(currentDocument);
        filename = generateMarkdownFilename(currentDocument.script.title);
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
    setMessage(`${formatName.toUpperCase()} 已下载：${filename}`);
  }

  async function handleCopyYaml() {
    if (!currentDocument) {
      setMessage("无法复制：结果 JSON 不是有效的 ScriptForgeDocument");
      return;
    }

    const yaml = yamlText || documentToYaml(currentDocument);
    try {
      await navigator.clipboard.writeText(yaml);
      setMessage("YAML 已复制到剪贴板");
    } catch {
      setMessage("复制失败，请手动选择文本复制");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-5">
        <header className="rounded-lg border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-cyan-700">ScriptForge M6</p>
              <h1 className="mt-1 text-3xl font-semibold text-zinc-950">作者工作台</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                载入章节、调整偏好、生成剧本、查看质量状态、理解来源追踪与改编报告，并导出可继续打磨的 YAML。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-300"
                  disabled={!activeWorkspace || saveState === "saving"}
                  onClick={() => void saveCurrentWorkspaceState()}
                  type="button"
                >
                  {saveState === "saving" ? "保存中..." : "保存当前状态"}
                </button>
                <span className={hasUnsavedState ? "text-sm font-medium text-amber-700" : "text-sm text-emerald-700"}>
                  {activeWorkspace ? (hasUnsavedState ? "有未保存状态" : "状态已保存") : "未保存工作区"}
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[34rem]">
              <StatusTile label="Message" value={message} tone="text-emerald-700" />
              <StatusTile label="Result" value={resultSourceLabel(resultSource)} />
              <StatusTile label="Validation" value={yamlValidation ? yamlValidation.status : "not checked"} />
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <PreferencePanel
              title={title}
              format={format}
              genre={genre}
              tone={tone}
              duration={duration}
              onTitleChange={(value) => {
                setTitle(value);
                setHasUnsavedState(true);
              }}
              onFormatChange={(value) => {
                setFormat(value);
                setHasUnsavedState(true);
              }}
              onGenreChange={(value) => {
                setGenre(value);
                setHasUnsavedState(true);
              }}
              onToneChange={(value) => {
                setTone(value);
                setHasUnsavedState(true);
              }}
              onDurationChange={(value) => {
                setDuration(value);
                setHasUnsavedState(true);
              }}
            />

            <InputPanel
              rawInput={rawInput}
              normalization={normalization}
              sampleMeta={sampleMeta}
              saveDisabled={!normalization.isValid || saveState === "saving"}
              saving={saveState === "saving"}
              onRawInputChange={(value) => {
                setRawInput(value);
                setHasUnsavedState(true);
              }}
              onLoadSample={() => void loadPublicDomainSample()}
              onSaveWorkspace={() => void saveWorkspace()}
            />

            <GenerationPanel
              generateState={generateState}
              generationError={generationError}
              diagnostics={generationDiagnostics}
              resultSource={resultSource}
              canGenerate={canGenerate}
              onGenerate={() => void generateDraft()}
            />

            <QualityPanel
              validation={yamlValidation}
              repairResult={repairResult}
              repairing={repairing}
              resultSource={resultSource}
              exportBlocked={yamlExportBlocked}
              onRepair={() => void handleAutoRepair()}
              onApplyRepair={handleApplyRepair}
            />

            <ScriptPreviewPanel document={currentDocument} />
            <AdaptationReportPanel document={currentDocument} />
            <YamlEditorPanel
              yamlText={yamlText}
              validation={yamlValidation}
              validating={yamlValidating}
              canExport={canExport}
              exportBlocked={yamlExportBlocked}
              onYamlChange={(value) => {
                setYamlText(value);
                setYamlValidation(null);
                setHasUnsavedState(true);
              }}
              onConvertToYaml={handleConvertToYaml}
              onRevalidate={() => void handleYamlRevalidate()}
              onCopyYaml={() => void handleCopyYaml()}
              onDownload={handleDownload}
            />
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold">结果 JSON</h2>
              <p className="mt-1 text-sm text-zinc-600">{activeWorkspace ? `当前工作区 ${activeWorkspace.id}` : "可直接生成；保存工作区不是必需步骤"}</p>
              <textarea
                className="mt-3 min-h-[360px] w-full resize-y rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 outline-none focus:border-cyan-700"
                onChange={(event) => handleResultTextChange(event.target.value)}
                placeholder="ScriptForgeDocument JSON。AI 生成、repair 应用或手动粘贴都会驱动右侧预览。"
                spellCheck={false}
                value={resultText}
              />
            </section>

            <WorkspaceList
              workspaces={workspaces}
              onRefresh={() => void refreshWorkspaces()}
              onLoadWorkspace={(id) => void loadWorkspace(id)}
            />
          </aside>
        </div>
      </section>
    </main>
  );
}

function StatusTile({ label, value, tone = "text-zinc-600" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="font-medium text-zinc-950">{label}</p>
      <p className={`mt-1 break-words ${tone}`}>{value}</p>
    </div>
  );
}
