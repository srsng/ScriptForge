import type { GenerationDiagnostic } from "@/lib/generation/types";

type GenerateState = "idle" | "loading" | "success" | "needs_revision" | "error";

export type GenerationStagePreview = {
  stage: "analyzer" | "planner" | "screenwriter" | "reporter";
  label: string;
  summary: string;
  json: string;
};

type StageProgressState = "pending" | "running" | "done" | "failed";

type GenerationPanelProps = {
  generateState: GenerateState;
  generationElapsedSeconds: number;
  generationError: string;
  diagnostics: GenerationDiagnostic[];
  stagePreviews: GenerationStagePreview[];
  currentStage: GenerationStagePreview["stage"] | null;
  canGenerate: boolean;
  onGenerate: () => void;
};

const FIXED_STAGE_PREVIEWS: Array<Pick<GenerationStagePreview, "stage" | "label"> & { emptySummary: string }> = [
  { stage: "analyzer", label: "梳理原文", emptySummary: "提炼章节要点与关键转折" },
  { stage: "planner", label: "规划场景", emptySummary: "安排人物出场、地点与场景顺序" },
  { stage: "screenwriter", label: "撰写剧本", emptySummary: "扩写场景动作、对白和节奏" },
  { stage: "reporter", label: "整理改编说明", emptySummary: "总结改编取舍与后续打磨方向" },
];

function generateStateLabel(state: GenerateState): string {
  switch (state) {
    case "loading":
      return "生成中";
    case "success":
      return "已生成";
    case "needs_revision":
      return "需要打磨";
    case "error":
      return "生成失败";
    case "idle":
      return "待生成";
  }
}

export function GenerationPanel({
  generateState,
  generationElapsedSeconds,
  generationError,
  diagnostics,
  stagePreviews,
  currentStage,
  canGenerate,
  onGenerate,
}: GenerationPanelProps) {
  const capacitySummary = diagnostics.find((item) => item.message.startsWith("容量概览："));
  const visibleDiagnostics = diagnostics.filter((item) => item !== capacitySummary);
  const loadingLabel = `生成中...(${generationElapsedSeconds}s)`;
  const stateLabel = generateState === "loading" ? loadingLabel : generateStateLabel(generateState);
  const capacityText = capacitySummary?.message
    .replace(/^容量概览：\s*/, "")
    .replace(/当前\s*(\d+)\s*场/g, "划分成$1个场景");
  const stagePreviewByStage = new Map(stagePreviews.map((preview) => [preview.stage, preview]));
  const completedStageSet = new Set(stagePreviews.map((preview) => preview.stage));
  const displayStagePreviews: GenerationStagePreview[] = FIXED_STAGE_PREVIEWS.map((fixed) => {
    const preview = stagePreviewByStage.get(fixed.stage);
    return preview ?? {
      stage: fixed.stage,
      label: fixed.label,
      summary: fixed.emptySummary,
      json: "",
    };
  });

  const stageProgressState = (stage: GenerationStagePreview["stage"]): StageProgressState => {
    if (completedStageSet.has(stage)) return "done";
    if (generateState === "error" && currentStage === stage) return "failed";
    if (generateState === "loading" && currentStage === stage) return "running";
    return "pending";
  };

  const stageProgressLabel = (state: StageProgressState): string => {
    switch (state) {
      case "running":
        return "进行中";
      case "done":
        return "已完成";
      case "failed":
        return "生成失败";
      case "pending":
        return "待开始";
    }
  };

  const stageProgressClassName = (state: StageProgressState): string => {
    switch (state) {
      case "running":
        return "bg-blue-50 text-blue-700 ring-blue-200";
      case "done":
        return "bg-emerald-50 text-emerald-700 ring-emerald-200";
      case "failed":
        return "bg-red-50 text-red-700 ring-red-200";
      case "pending":
        return "bg-zinc-100 text-zinc-600 ring-zinc-200";
    }
  };

  const severityLabel = (severity: GenerationDiagnostic["severity"]): string => {
    switch (severity) {
      case "error":
        return "需处理";
      case "warning":
        return "建议";
      case "info":
      default:
        return "提示";
    }
  };

  const stageLabel = (stage: GenerationDiagnostic["stage"]): string => {
    switch (stage) {
      case "quality":
        return "质量检查";
      case "validation":
        return "结构检查";
      case "analyzer":
        return "原文整理";
      case "planner":
        return "场景规划";
      case "screenwriter":
        return "剧本写作";
      case "reporter":
        return "改编说明";
    }
  };

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">生成剧本初稿</h2>
          <p className="text-sm text-zinc-600">把章节和改编目标整理为可继续打磨的剧本初稿，并提示篇幅与质量状态。</p>
        </div>
        <button
          className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:bg-zinc-300"
          disabled={!canGenerate || generateState === "loading"}
          onClick={onGenerate}
          type="button"
        >
          {generateState === "loading" ? loadingLabel : "生成剧本初稿"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">状态</div>
          <div className="mt-1 text-zinc-600">{stateLabel}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">提示</div>
          <div className="mt-1 text-zinc-600">{visibleDiagnostics.length} 条</div>
        </div>
      </div>

      {generateState === "needs_revision" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          剧本已生成，但篇幅、场景推进、动作或对白还不够充分，建议继续扩写或重新生成。
        </div>
      ) : null}

      {capacitySummary ? (
        <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
          <div className="font-medium">篇幅参考</div>
          <p className="mt-1">{capacityText}</p>
        </div>
      ) : null}

      {displayStagePreviews.length > 0 ? (
        <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3 text-sm">
          <div className="font-medium">创作进度</div>
          <div className="mt-2 flex flex-col gap-2">
            {displayStagePreviews.map((preview) => {
              const progressState = stageProgressState(preview.stage);
              const hasResult = completedStageSet.has(preview.stage);
              return (
                <details className="rounded-md border border-zinc-200 bg-zinc-50 p-2" key={preview.stage} open={progressState === "running" || hasResult}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-zinc-800 marker:hidden">
                    <span>{preview.label}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ${stageProgressClassName(progressState)}`}>
                      {stageProgressLabel(progressState)}
                    </span>
                  </summary>
                  <p className="mt-2 text-zinc-600">{preview.summary}</p>
                </details>
              );
            })}
          </div>
        </div>
      ) : null}

      {(generationError || visibleDiagnostics.length > 0) && (
        <div className="mt-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {generationError ? <p className="font-medium text-red-700">{generationError}</p> : null}
          {visibleDiagnostics.length > 0 ? (
            <ul className="space-y-1 text-zinc-700">
              {visibleDiagnostics.map((item, index) => (
                <li key={`${item.stage}-${index}`}>
                  <span className="font-medium">[{severityLabel(item.severity)}] {stageLabel(item.stage)}</span>：{item.message}
                  {item.details ? <div className="mt-0.5 text-xs text-zinc-500">{item.details}</div> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
