import type { ValidationResult } from "@/lib/schema";
import type { RepairResult } from "@/lib/repair";
import type { ResultSource } from "./utils";
import { resultSourceLabel, validationSummary } from "./utils";

type QualityPanelProps = {
  validation: ValidationResult | null;
  repairResult: RepairResult | null;
  repairing: boolean;
  resultSource: ResultSource;
  needsRevision: boolean;
  exportBlocked: boolean;
  onRepair: () => void;
  onApplyRepair: () => void;
};

export function QualityPanel({
  validation,
  repairResult,
  repairing,
  resultSource,
  needsRevision,
  exportBlocked,
  onRepair,
  onApplyRepair,
}: QualityPanelProps) {
  const validationTone = validation?.status === "pass"
    ? "text-emerald-700"
    : validation?.status === "warn"
      ? "text-amber-700"
      : validation?.status === "error"
        ? "text-red-700"
        : "text-zinc-600";

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">质量状态</h2>
          <p className="text-sm text-zinc-600">ValidationResult / RepairResult 和内容密度门禁在这里汇总。</p>
        </div>
        <button
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-zinc-300"
          disabled={repairing}
          onClick={onRepair}
          type="button"
        >
          {repairing ? "修复中..." : "自动修复"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">校验</div>
          <div className={`mt-1 ${validationTone}`}>{validationSummary(validation)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">来源</div>
          <div className="mt-1 text-zinc-600">{resultSourceLabel(resultSource)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">导出</div>
          <div className={exportBlocked ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>
            {exportBlocked ? "导出已阻止" : "可继续处理"}
          </div>
        </div>
      </div>

      {needsRevision ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          结构化草稿不满足目标时长或剧本密度要求：请重点补足场景过程、beats 数量和对白轮次后再作为成品处理。
        </div>
      ) : null}

      {validation && validation.errors.length > 0 ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">错误</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
            {validation.errors.map((err, index) => (
              <li key={`${err.path}-${index}`}>
                <code className="text-xs">{err.path}</code> — {err.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {validation && validation.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">警告</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
            {validation.warnings.map((warning, index) => (
              <li key={`${warning.path}-${index}`}>
                <code className="text-xs">{warning.path}</code> — {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {repairResult ? (
        <div className={`mt-4 rounded-md border p-3 text-sm ${repairResult.status === "ok" ? "border-emerald-200 bg-emerald-50" : repairResult.status === "partial" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">repair 结果：{repairResult.status}</p>
            <span className="text-xs text-zinc-600">{repairResult.appliedFixes.length} 项修复</span>
          </div>
          {repairResult.appliedFixes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
              {repairResult.appliedFixes.map((fix, index) => (
                <li key={`${fix.path}-${index}`}>
                  <code className="mr-1 rounded bg-white px-1 text-xs">{fix.path}</code>{fix.message}
                </li>
              ))}
            </ul>
          ) : null}
          {repairResult.diagnostics.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-red-700">
              {repairResult.diagnostics.slice(0, 8).map((item, index) => (
                <li key={`${item.path}-${index}`}>
                  <code className="mr-1 rounded bg-white px-1 text-xs">{item.path}</code>{item.message}
                </li>
              ))}
            </ul>
          ) : null}
          {repairResult.document ? (
            <button className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700" onClick={onApplyRepair} type="button">
              应用修复结果
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
