import type { ValidationResult } from "@/lib/schema";

type GenerateState = "idle" | "loading" | "success" | "needs_revision" | "error";
type ProcessStepStatus = "done" | "current" | "pending" | "error";

type ProcessGuideProps = {
  inputReady: boolean;
  hasTarget: boolean;
  generateState: GenerateState;
  validation: ValidationResult | null;
  hasDocument: boolean;
  exportBlocked: boolean;
};

type ProcessStep = {
  label: string;
  status: ProcessStepStatus;
};

const stepClassNames: Record<ProcessStepStatus, string> = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-900",
  current: "border-cyan-300 bg-cyan-50 text-cyan-950",
  pending: "border-zinc-200 bg-zinc-50 text-zinc-600",
  error: "border-red-200 bg-red-50 text-red-800",
};

const statusLabels: Record<ProcessStepStatus, string> = {
  done: "已完成",
  current: "当前",
  pending: "待处理",
  error: "需处理",
};

function buildProcessSteps(props: ProcessGuideProps): ProcessStep[] {
  const generationCompleted = props.hasDocument || props.generateState === "success" || props.generateState === "needs_revision";
  const generationError = props.generateState === "error";
  const validationChecked = props.validation !== null;
  const validationDone = props.validation !== null && props.validation.valid;
  const validationFailed = props.validation !== null && !props.validation.valid;
  const readyToExport = props.hasDocument && !props.exportBlocked && validationDone;

  const steps: ProcessStep[] = [
    { label: "准备章节", status: "pending" },
    { label: "设置目标", status: "pending" },
    { label: "生成剧本", status: "pending" },
    { label: "检查剧本", status: "pending" },
    { label: "整理或重试", status: "pending" },
    { label: "导出交付", status: "pending" },
  ];

  if (props.inputReady) steps[0].status = "done";
  if (props.inputReady && props.hasTarget) steps[1].status = "done";
  if (generationCompleted) steps[2].status = "done";
  if (validationDone) steps[3].status = "done";
  if (readyToExport) steps[4].status = "done";
  if (generationError) steps[2].status = "error";
  if (validationFailed) steps[3].status = "error";

  const currentIndex = (() => {
    if (!props.inputReady) return 0;
    if (!props.hasTarget) return 1;
    if (props.generateState === "loading" || (!generationCompleted && !generationError)) return 2;
    if (generationError || validationFailed || props.generateState === "needs_revision" || props.exportBlocked) return 4;
    if (!validationChecked) return 3;
    return 5;
  })();

  if (steps[currentIndex].status !== "error") steps[currentIndex].status = "current";

  return steps;
}

function nextActionText(props: ProcessGuideProps): string {
  if (!props.inputReady) return "下一步：粘贴或随机载入至少 3 个连续章节。";
  if (!props.hasTarget) return "下一步：补全工作区标题、类型、风格和目标时长。";
  if (props.generateState === "loading") return "正在生成剧本，请稍等。";
  if (props.generateState === "error") return "生成失败：请查看错误详情后重试；若连续失败，减少样本章节数或调整目标后再生成。";
  if (!props.hasDocument) return "下一步：点击生成剧本。";
  if (!props.validation) return "下一步：生成剧本后重新检查。";
  if (!props.validation.valid) return "下一步：检查问题，可先查看整理建议；无法整理时建议重新生成。";
  if (props.generateState === "needs_revision") return "下一步：按后续修改建议或自定义要求改写，或重新生成更完整的剧本。";
  if (props.exportBlocked) return "下一步：修正剧本里的问题后再导出。";
  return "下一步：下载修改稿、全部内容或阅读稿继续打磨。";
}

export function ProcessGuide(props: ProcessGuideProps) {
  const steps = buildProcessSteps(props);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">创作步骤</h2>
          <p className="text-sm text-zinc-600">按章节准备、目标设置、生成、检查、整理或重试、导出推进。</p>
        </div>
        <p className="max-w-xl text-sm font-medium text-cyan-800">{nextActionText(props)}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step, index) => (
          <div className={`rounded-md border px-3 py-2 text-sm ${stepClassNames[step.status]}`} key={step.label}>
            <div className="text-xs font-medium">步骤 {index + 1} · {statusLabels[step.status]}</div>
            <div className="mt-1 font-semibold">{step.label}</div>
          </div>
        ))}
      </div>

    </section>
  );
}
