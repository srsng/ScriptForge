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
import type {
  AnalyzerStageOutput,
  GenerationDiagnostic,
  GenerationStageMetrics,
  PlannerStageOutput,
  PromptBundle,
  ReporterStageOutput,
  ScreenwriterStageOutput,
} from "@/lib/generation/types";
import type {
  GenerationRequest,
  InputNormalizationResult,
  ScriptForgeDocument,
  ScriptFormat,
  WorkspaceState,
} from "@/types/scriptforge";
import { AdaptationReportPanel } from "./AdaptationReportPanel";
import { GenerationPanel, type GenerationStagePreview } from "./GenerationPanel";
import { InputPanel } from "./InputPanel";
import { PreferencePanel } from "./PreferencePanel";
import { ProcessGuide } from "./ProcessGuide";
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
  selection?: {
    requestedCount: number;
    chapterCount: number;
    startTitle: string;
    endTitle: string;
  };
};

type SaveState = "idle" | "saving" | "saved" | "error";
type GenerateState = "idle" | "loading" | "success" | "needs_revision" | "error";

type GenerateResponse = {
  document?: ScriptForgeDocument;
  scriptYaml?: string;
  validation?: ValidationResult;
  diagnostics?: GenerationDiagnostic[];
  resultSource?: ResultSource;
  workspaceId?: string;
  status?: "ai_success" | "degraded" | "needs_revision" | "error";
  error?: string;
};

type StageApiResponse<T> = {
  status: "ok" | "error";
  output?: T;
  diagnostics?: GenerationDiagnostic[];
  metrics?: GenerationStageMetrics;
  prompt?: PromptBundle;
  model?: string;
  error?: string;
};

const EMPTY_RESULT_TEXT = "";
const STAGE_LABELS: Record<GenerationStagePreview["stage"], string> = {
  analyzer: "Analyzer",
  planner: "Planner",
  screenwriter: "Screenwriter",
  reporter: "Reporter",
};

function previewJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stageSummary(stage: GenerationStagePreview["stage"], output: unknown): string {
  if (stage === "analyzer") {
    const analyzer = output as AnalyzerStageOutput;
    const factCount = analyzer.source.chapters.reduce((sum, chapter) => sum + chapter.key_facts.length, 0);
    return `${analyzer.source.chapters.length} 章，${factCount} 条 facts`;
  }
  if (stage === "planner") {
    const planner = output as PlannerStageOutput;
    return `${planner.characters.length} 人物，${planner.locations.length} 地点，${planner.scene_plan.length} 场面卡`;
  }
  if (stage === "screenwriter") {
    const screenwriter = output as ScreenwriterStageOutput;
    const beatCount = screenwriter.scenes.reduce((sum, scene) => sum + scene.beats.length, 0);
    return `${screenwriter.scenes.length} 场，${beatCount} beats`;
  }
  const reporter = output as ReporterStageOutput;
  return `${reporter.title || "未命名"}，${reporter.adaptation_report.revision_suggestions.length} 条后续改进`;
}

export function WorkbenchShell() {
  const [rawInput, setRawInput] = useState("");
  const [title, setTitle] = useState("新建小说改编工作区");
  const [format, setFormat] = useState<ScriptFormat>("short_drama");
  const [genre, setGenre] = useState("未指定");
  const [tone, setTone] = useState("未指定");
  const [duration, setDuration] = useState(11);
  const [workspaces, setWorkspaces] = useState<WorkspaceIndexEntry[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceRecord | null>(null);
  const [resultText, setResultText] = useState(EMPTY_RESULT_TEXT);
  const [resultSource, setResultSource] = useState<ResultSource>("none");
  const [sampleMeta, setSampleMeta] = useState<Pick<SampleResponse, "title" | "author" | "source" | "license_note"> | null>(null);
  const [sampleChapterCount, setSampleChapterCount] = useState(3);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("准备输入");
  const [generateState, setGenerateState] = useState<GenerateState>("idle");
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [generationDiagnostics, setGenerationDiagnostics] = useState<GenerationDiagnostic[]>([]);
  const [generationStagePreviews, setGenerationStagePreviews] = useState<GenerationStagePreview[]>([]);
  const [generationError, setGenerationError] = useState("");
  const [yamlText, setYamlText] = useState("");
  const [yamlValidation, setYamlValidation] = useState<ValidationResult | null>(null);
  const [yamlValidating, setYamlValidating] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [revising, setRevising] = useState(false);
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
  const displayMessage = generateState === "loading" ? `生成中...(${generationElapsedSeconds}s)` : message;

  useEffect(() => {
    if (generateState !== "loading" || generationStartedAt === null) return;

    const updateElapsedSeconds = () => {
      setGenerationElapsedSeconds(Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000)));
    };

    updateElapsedSeconds();
    const timerId = window.setInterval(updateElapsedSeconds, 1000);
    return () => window.clearInterval(timerId);
  }, [generateState, generationStartedAt]);

  function buildWorkspaceState(overrides: Partial<WorkspaceState> = {}): WorkspaceState {
    return {
      schema_version: "1.1",
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
    setGenerationStagePreviews([]);
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

  async function loadQuanZhiGaoShouSample() {
    setMessage("正在载入《全职高手》内置测试样本");
    const response = await fetch(`/api/samples/quan-zhi-gao-shou?chapters=${sampleChapterCount}`);
    const sample = (await response.json()) as SampleResponse;
    if (!response.ok) {
      setMessage((sample as { error?: string }).error ?? "样本载入失败");
      return;
    }

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
    setGenerationDiagnostics([]);
    setGenerationStagePreviews([]);
    setGenerationError("");
    setHasUnsavedState(true);
    const selectionText = sample.selection
      ? `：${sample.selection.startTitle} 至 ${sample.selection.endTitle}`
      : "";
    setMessage(`已载入 ${sample.normalization.chapters.length} 章《全职高手》测试样本${selectionText}`);
  }

  async function saveAsNewWorkspace() {
    setSaveState("saving");
    setMessage("正在另存为新工作区");
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
    setMessage(`已另存为新工作区 ${workspace.id}`);
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
      setMessage("请先另存为新工作区或加载已有工作区，再保存当前工作区");
      return;
    }

    setSaveState("saving");
    setMessage("正在保存当前工作区");
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
    setMessage(`当前工作区已保存到 ${workspace.id}`);
  }

  async function generateDraft() {
    setGenerationStartedAt(Date.now());
    setGenerationElapsedSeconds(0);
    setGenerateState("loading");
    setGenerationError("");
    setGenerationDiagnostics([]);
    setGenerationStagePreviews([]);
    setResultText(EMPTY_RESULT_TEXT);
    setYamlText("");
    setYamlValidation(null);
    setRepairResult(null);
    setMessage("正在生成剧本初稿");

    const basePayload = {
      request: currentGenerationRequest,
      workspaceId: activeWorkspace?.id,
    };
    const diagnostics: GenerationDiagnostic[] = [];
    const promptStages: PromptBundle[] = [];
    let model: string | undefined;

    async function runStageRequest<T>(
      stage: GenerationStagePreview["stage"],
      endpoint: string,
      body: Record<string, unknown>,
    ): Promise<T> {
      setMessage(`正在执行 ${STAGE_LABELS[stage]} 阶段`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as StageApiResponse<T>;
      diagnostics.push(...(data.diagnostics ?? []));
      setGenerationDiagnostics([...diagnostics]);
      if (!response.ok || data.status === "error" || !data.output) {
        throw new Error(data.error ?? `${STAGE_LABELS[stage]} 阶段失败`);
      }

      if (data.prompt) promptStages.push(data.prompt);
      model = data.model ?? model;
      setGenerationStagePreviews((current) => [
        ...current.filter((item) => item.stage !== stage),
        {
          stage,
          label: STAGE_LABELS[stage],
          summary: stageSummary(stage, data.output),
          json: previewJson(data.output),
        },
      ]);
      setMessage(`${STAGE_LABELS[stage]} 阶段完成`);
      return data.output;
    }

    try {
      const analyzer = await runStageRequest<AnalyzerStageOutput>("analyzer", "/api/generate/analyzer", basePayload);
      const planner = await runStageRequest<PlannerStageOutput>("planner", "/api/generate/planner", {
        ...basePayload,
        analyzer,
      });
      const screenwriter = await runStageRequest<ScreenwriterStageOutput>("screenwriter", "/api/generate/screenwriter", {
        ...basePayload,
        analyzer,
        planner,
      });
      const reporter = await runStageRequest<ReporterStageOutput>("reporter", "/api/generate/reporter", {
        ...basePayload,
        analyzer,
        planner,
        screenwriter,
      });

      setMessage("正在组装并校验剧本");
      const response = await fetch("/api/generate/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...basePayload,
          analyzer,
          planner,
          screenwriter,
          reporter,
          diagnostics,
          promptStages,
          model,
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || data.status === "error") {
        throw new Error(data.error ?? "AI 生成失败");
      }
      if (!data.document) {
        throw new Error(data.error ?? "AI 没有返回可展示的剧本草稿");
      }

      setResultText(jsonPreview(data.document));
      setYamlText(data.scriptYaml ?? documentToYaml(data.document));
      setYamlValidation(data.validation ?? null);
      setGenerationDiagnostics(data.diagnostics ?? []);
      setGenerateState(data.status === "needs_revision" ? "needs_revision" : "success");
      const source = data.resultSource ?? (data.status === "needs_revision" ? "ai_draft" : "ai");
      setResultSource(source);
      const successMessage = data.status === "needs_revision"
        ? "AI 返回了结构化草稿，但剧本质量不足，不满足目标时长，建议重新生成或手动加强。"
        : "已生成 AI 剧本初稿";
      if (activeWorkspace) {
        await saveCurrentWorkspaceState({
          result: data.document,
          resultSource: source,
          yamlText: data.scriptYaml ?? documentToYaml(data.document),
          yamlValidation: data.validation ?? null,
          generationDiagnostics: data.diagnostics ?? [],
          generationError: "",
          message: successMessage,
        });
      } else {
        setHasUnsavedState(true);
      }
      setMessage(successMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(errorMessage);
      setGenerateState("error");
      setMessage(errorMessage);
    } finally {
      setGenerationStartedAt(null);
    }
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
    setMessage("正在检查可自动修复项");
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

      if (result.appliedFixes.length > 0) {
        setMessage(`发现 ${result.appliedFixes.length} 项可自动修复内容，请预览后应用`);
      } else if (result.status === "ok") {
        setMessage("未发现需要自动应用的修复项");
      } else if (result.status === "partial") {
        setMessage(`部分问题无法自动修复：${result.diagnostics.length} 条需要手动处理`);
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

  async function handleReviseByDirections(directions: string[]) {
    if (!currentDocument) {
      setMessage("没有可改写内容：请先生成剧本草稿");
      return;
    }
    if (directions.length === 0) {
      setMessage("缺少后续修改建议，无法改写");
      return;
    }

    setRevising(true);
    setGenerationError("");
    setMessage("正在按后续修改建议改写");

    try {
      const response = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: currentGenerationRequest,
          document: currentDocument,
          directions,
        }),
      });
      const data = (await response.json()) as GenerateResponse;

      if (!response.ok || data.status === "error") {
        throw new Error(data.error ?? "后续修改建议改写失败");
      }
      if (!data.document) {
        throw new Error(data.error ?? "AI 没有返回可展示的改写剧本");
      }

      const yaml = data.scriptYaml ?? documentToYaml(data.document);
      const source = data.resultSource ?? (data.status === "needs_revision" ? "ai_draft" : "ai");
      const nextMessage = data.status === "needs_revision"
        ? "已按后续修改建议改写，但剧本质量仍需继续加强。"
        : "已按后续修改建议改写剧本";

      setResultText(jsonPreview(data.document));
      setYamlText(yaml);
      setYamlValidation(data.validation ?? null);
      setGenerationDiagnostics(data.diagnostics ?? []);
      setGenerateState(data.status === "needs_revision" ? "needs_revision" : "success");
      setResultSource(source);
      setRepairResult(null);

      if (activeWorkspace) {
        await saveCurrentWorkspaceState({
          result: data.document,
          resultSource: source,
          yamlText: yaml,
          yamlValidation: data.validation ?? null,
          generationDiagnostics: data.diagnostics ?? [],
          generationError: "",
          message: nextMessage,
        });
      } else {
        setHasUnsavedState(true);
      }
      setMessage(nextMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setRevising(false);
    }
  }

  async function handleApplyRepair() {
    if (!repairResult?.document || repairResult.appliedFixes.length === 0) return;

    const repairedYaml = repairResult.yamlText ?? documentToYaml(repairResult.document);
    setResultText(jsonPreview(repairResult.document));
    setYamlText(repairedYaml);
    setRepairResult(null);
    setHasUnsavedState(true);
    setMessage("修复结果已应用，正在重新校验 YAML");

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yamlText: repairedYaml }),
      });
      const validation = (await response.json()) as ValidationResult;
      setYamlValidation(validation);
      if (validation.valid) {
        setMessage("修复结果已应用，YAML 校验通过");
      } else {
        setMessage(`修复结果已应用，仍有 ${validation.errors.length} 条错误需要处理`);
      }
    } catch {
      setMessage("修复结果已应用，但重新校验请求失败");
    }
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
                从连续小说章节出发，先确定改编目标，再生成结构化剧本草稿；生成后按校验、修复或重试、导出的顺序推进。
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:border-zinc-200 disabled:text-zinc-400"
                  disabled={!normalization.isValid || saveState === "saving"}
                  onClick={() => void saveAsNewWorkspace()}
                  type="button"
                >
                  {saveState === "saving" ? "保存中..." : "另存为新工作区"}
                </button>
                <button
                  className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:bg-zinc-300"
                  disabled={!activeWorkspace || !normalization.isValid || saveState === "saving"}
                  onClick={() => void saveCurrentWorkspaceState()}
                  type="button"
                >
                  {saveState === "saving" ? "保存中..." : "保存当前工作区"}
                </button>
                <span className={hasUnsavedState ? "text-sm font-medium text-amber-700" : "text-sm text-emerald-700"}>
                  {activeWorkspace ? (hasUnsavedState ? "有未保存状态" : "状态已保存") : "未保存工作区"}
                </span>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-3 lg:w-[34rem]">
              <StatusTile label="Message" value={displayMessage} tone="text-emerald-700" />
              <StatusTile label="Result" value={resultSourceLabel(resultSource)} />
              <StatusTile label="Validation" value={yamlValidation ? yamlValidation.status : "not checked"} />
            </div>
          </div>
        </header>

        <ProcessGuide
          inputReady={normalization.isValid}
          hasTarget={Boolean(title.trim() && genre.trim() && tone.trim() && duration > 0)}
          generateState={generateState}
          validation={yamlValidation}
          hasDocument={currentDocument !== null}
          exportBlocked={yamlExportBlocked}
          generationError={generationError}
          diagnostics={generationDiagnostics}
        />

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
              sampleChapterCount={sampleChapterCount}
              onRawInputChange={(value) => {
                setRawInput(value);
                setHasUnsavedState(true);
              }}
              onSampleChapterCountChange={(value) => setSampleChapterCount(Number.isFinite(value) ? Math.max(3, value) : 3)}
              onLoadSample={() => void loadQuanZhiGaoShouSample()}
            />

            <GenerationPanel
              generateState={generateState}
              generationElapsedSeconds={generationElapsedSeconds}
              generationError={generationError}
              diagnostics={generationDiagnostics}
              stagePreviews={generationStagePreviews}
              resultSource={resultSource}
              targetDurationMinutes={duration}
              canGenerate={canGenerate}
              onGenerate={() => void generateDraft()}
            />

            <QualityPanel
              validation={yamlValidation}
              repairResult={repairResult}
              repairing={repairing}
              needsRevision={generateState === "needs_revision"}
              exportBlocked={yamlExportBlocked}
              onRepair={() => void handleAutoRepair()}
              onApplyRepair={() => void handleApplyRepair()}
            />

            <ScriptPreviewPanel document={currentDocument} validation={yamlValidation} />
            <AdaptationReportPanel
              document={currentDocument}
              revising={revising}
              validation={yamlValidation}
              onReviseByDirections={(directions) => void handleReviseByDirections(directions)}
            />
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
