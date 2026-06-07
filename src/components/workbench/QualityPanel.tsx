import type { ValidationResult } from "@/lib/schema";
import type { RepairResult } from "@/lib/repair";
import { validationSummary } from "./utils";

type QualityPanelProps = {
  validation: ValidationResult | null;
  repairResult: RepairResult | null;
  repairing: boolean;
  needsRevision: boolean;
  exportBlocked: boolean;
  exportBlockedReason: string;
  onRepair: () => void;
  onApplyRepair: () => void;
};

export function QualityPanel({
  validation,
  repairResult,
  repairing,
  needsRevision,
  exportBlocked,
  exportBlockedReason,
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
          <p className="text-sm text-zinc-600">汇总 Schema 校验、引用问题、剧本质量门禁和导出状态。</p>
        </div>
        <button
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-zinc-300"
          disabled={repairing}
          onClick={onRepair}
          type="button"
        >
          {repairing ? "检查中..." : "检查可自动修复项"}
        </button>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        自动修复只处理缺失字段、轻量类型问题和可确定的引用替换；不会改写剧情。检查后请先预览，再决定是否应用。
      </p>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">校验</div>
          <div className={`mt-1 ${validationTone}`}>{validationSummary(validation)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">导出</div>
          <div className={exportBlocked ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>
            {exportBlocked ? `导出已阻止：${exportBlockedReason}` : "可继续处理"}
          </div>
        </div>
      </div>

      {needsRevision ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          结构化草稿不满足目标时长或剧本质量要求：请重点补足自然场景过程、渲染氛围、动作过程、对白潜台词和动作配合后再作为成品处理。
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
            <p className="font-semibold">修复预览：{repairResult.status}</p>
            <span className="text-xs text-zinc-600">{repairResult.appliedFixes.length} 项修复</span>
          </div>
          {repairResult.appliedFixes.length === 0 ? (
            <p className="mt-2 text-zinc-700">没有发现可自动应用的修复项。请根据错误信息手动处理，或重新生成草稿。</p>
          ) : null}
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
          {repairResult.document && repairResult.appliedFixes.length > 0 ? (
            <button className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700" onClick={onApplyRepair} type="button">
              应用 {repairResult.appliedFixes.length} 项修复
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
