import type { GenerationDiagnostic } from "@/lib/generation/types";
import type { ResultSource } from "./utils";
import { resultSourceLabel } from "./utils";

type GenerateState = "idle" | "loading" | "success" | "needs_revision" | "error";

type GenerationPanelProps = {
  generateState: GenerateState;
  generationError: string;
  diagnostics: GenerationDiagnostic[];
  resultSource: ResultSource;
  targetDurationMinutes: number;
  canGenerate: boolean;
  onGenerate: () => void;
};

const stageLabels = ["输入", "生成", "校验", "repair", "导出"] as const;

function generateStateLabel(state: GenerateState): string {
  switch (state) {
    case "loading":
      return "生成中";
    case "success":
      return "成功";
    case "needs_revision":
      return "剧本质量不足";
    case "error":
      return "失败";
    case "idle":
      return "待生成";
  }
}

export function GenerationPanel({
  generateState,
  generationError,
  diagnostics,
  resultSource,
  targetDurationMinutes,
  canGenerate,
  onGenerate,
}: GenerationPanelProps) {
  const capacitySummary = diagnostics.find((item) => item.message.startsWith("CAPACITY_SUMMARY:"));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">生成流程</h2>
          <p className="text-sm text-zinc-600">AI 生成结构化剧本草稿，并输出阶段诊断与容量指标</p>
        </div>
        <button
          className="rounded-md bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:bg-zinc-300"
          disabled={!canGenerate || generateState === "loading"}
          onClick={onGenerate}
          type="button"
        >
          {generateState === "loading" ? "生成中..." : "AI 生成剧本初稿"}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {stageLabels.map((stage, index) => (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm" key={stage}>
            <div className="text-xs font-medium text-zinc-500">Step {index + 1}</div>
            <div className="mt-1 font-medium">{stage}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">状态</div>
          <div className="mt-1 text-zinc-600">{generateStateLabel(generateState)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">结果来源</div>
          <div className="mt-1 text-zinc-600">{resultSourceLabel(resultSource)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">诊断</div>
          <div className="mt-1 text-zinc-600">{diagnostics.length} 条</div>
        </div>
      </div>

      {generateState === "needs_revision" ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          结构化草稿已返回；部分参考容量指标可能接近目标，但文本厚度、场景过程、动作或对白质量仍可能无法支撑 {targetDurationMinutes} 分钟目标时长。
        </div>
      ) : null}

      {capacitySummary ? (
        <div className="mt-4 rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">
          <div className="font-medium">容量指标</div>
          <p className="mt-1">{capacitySummary.message.replace(/^CAPACITY_SUMMARY:\s*/, "")}</p>
        </div>
      ) : null}

      {(generationError || diagnostics.length > 0) && (
        <div className="mt-4 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {generationError ? <p className="font-medium text-red-700">{generationError}</p> : null}
          {diagnostics.length > 0 ? (
            <ul className="space-y-1 text-zinc-700">
              {diagnostics.map((item, index) => (
                <li key={`${item.stage}-${index}`}>
                  <span className="font-medium">[{item.severity ?? "info"}] {item.stage}</span>：{item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
