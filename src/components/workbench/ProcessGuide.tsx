import type { ValidationResult } from "@/lib/schema";
import type { GenerationDiagnostic } from "@/lib/generation/types";

type GenerateState = "idle" | "loading" | "success" | "needs_revision" | "error";
type ProcessStepStatus = "done" | "current" | "pending" | "error";

type ProcessGuideProps = {
  inputReady: boolean;
  hasTarget: boolean;
  generateState: GenerateState;
  validation: ValidationResult | null;
  hasDocument: boolean;
  exportBlocked: boolean;
  generationError: string;
  diagnostics: GenerationDiagnostic[];
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

function hasMissingReferenceIssue(validation: ValidationResult | null, generationError: string, diagnostics: GenerationDiagnostic[]): boolean {
  const messages = [
    generationError,
    ...diagnostics.map((item) => `${item.message} ${item.details ?? ""}`),
    ...(validation?.errors ?? []).map((item) => item.message),
    ...(validation?.warnings ?? []).map((item) => item.message),
  ].join("\n");

  return /(不在|不存在|引用无效|缺少).*?(id|ID|角色|地点|来源章节|来源事实|fact|character|location|chapter)/i.test(messages);
}

function buildProcessSteps(props: ProcessGuideProps): ProcessStep[] {
  const generationDone = props.generateState === "success" || props.generateState === "needs_revision";
  const generationError = props.generateState === "error";
  const validationDone = props.validation !== null && props.validation.valid;
  const validationError = props.validation?.status === "error";
  const needsRepair = generationError || validationError || props.generateState === "needs_revision";
  const readyToExport = props.hasDocument && !props.exportBlocked && validationDone;

  return [
    {
      label: "准备章节",
      status: props.inputReady ? "done" : "current",
    },
    {
      label: "设置目标",
      status: !props.inputReady ? "pending" : props.hasTarget ? "done" : "current",
    },
    {
      label: "生成草稿",
      status: generationError ? "error" : generationDone ? "done" : props.inputReady && props.hasTarget ? "current" : "pending",
    },
    {
      label: "校验质量",
      status: validationError ? "error" : validationDone ? "done" : generationDone || props.hasDocument ? "current" : "pending",
    },
    {
      label: "修复或重试",
      status: needsRepair ? "current" : validationDone ? "done" : "pending",
    },
    {
      label: "导出交付",
      status: readyToExport ? "current" : "pending",
    },
  ];
}

function nextActionText(props: ProcessGuideProps): string {
  if (!props.inputReady) return "下一步：粘贴或随机载入至少 3 个连续章节。";
  if (!props.hasTarget) return "下一步：补全工作区标题、类型、风格和目标时长。";
  if (props.generateState === "loading") return "当前正在生成，请等待阶段结果返回。";
  if (props.generateState === "error") return "生成失败：请查看错误详情后重试；若连续失败，减少样本章节数或调整目标后再生成。";
  if (!props.hasDocument) return "下一步：点击 AI 生成剧本初稿。";
  if (!props.validation) return "下一步：生成 YAML 后重新校验。";
  if (!props.validation.valid) return "下一步：检查错误，可先预览自动修复项；无法修复时建议重新生成。";
  if (props.generateState === "needs_revision") return "下一步：按后续修改建议改写，或重新生成更厚实的草稿。";
  if (props.exportBlocked) return "下一步：修复 YAML 校验错误后再导出。";
  return "下一步：导出 YAML、JSON 或 Markdown 继续打磨。";
}

export function ProcessGuide(props: ProcessGuideProps) {
  const steps = buildProcessSteps(props);
  const showMissingReferenceIssue = hasMissingReferenceIssue(props.validation, props.generationError, props.diagnostics);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">当前流程</h2>
          <p className="text-sm text-zinc-600">按章节准备、目标设置、生成、校验、修复或重试、导出推进。</p>
        </div>
        <p className="max-w-xl text-sm font-medium text-cyan-800">{nextActionText(props)}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        {steps.map((step, index) => (
          <div className={`rounded-md border px-3 py-2 text-sm ${stepClassNames[step.status]}`} key={step.label}>
            <div className="text-xs font-medium">Step {index + 1} · {statusLabels[step.status]}</div>
            <div className="mt-1 font-semibold">{step.label}</div>
          </div>
        ))}
      </div>

      {showMissingReferenceIssue ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          引用 ID 不存在：生成结果里可能引用了不存在的角色、地点、来源章节或来源事实。建议重新生成；如果重复出现，先减少载入章节数或调整目标后再试。
        </div>
      ) : null}
    </section>
  );
}
