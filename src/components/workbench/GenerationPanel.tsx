import type { GenerationDiagnostic } from "@/lib/generation/types";
import type { ResultSource } from "./utils";
import { resultSourceLabel } from "./utils";

type GenerateState = "idle" | "loading" | "done" | "error";

type GenerationPanelProps = {
  generateState: GenerateState;
  generationError: string;
  diagnostics: GenerationDiagnostic[];
  resultSource: ResultSource;
  canGenerate: boolean;
  onGenerate: () => void;
};

const stageLabels = ["输入", "生成", "校验", "repair", "导出"] as const;

export function GenerationPanel({
  generateState,
  generationError,
  diagnostics,
  resultSource,
  canGenerate,
  onGenerate,
}: GenerationPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">生成流程</h2>
          <p className="text-sm text-zinc-600">AI 生成后进入校验；失败时显示 fallback 或 repair 状态，不隐藏来源。</p>
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
          <div className="mt-1 text-zinc-600">{generateState === "loading" ? "生成中" : generateState === "error" ? "失败" : generateState === "done" ? "完成" : "待生成"}</div>
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
