import type { ValidationResult } from "@/lib/schema";
import type { RepairResult } from "@/lib/repair";
import { formatValidationPath, userFacingIssueMessage, validationSummary } from "./utils";

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
          <h2 className="text-lg font-semibold">检查状态</h2>
          <p className="text-sm text-zinc-600">汇总剧本结构、完整度和导出状态。</p>
        </div>
        <button
          className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:bg-zinc-300"
          disabled={repairing}
          onClick={onRepair}
          type="button"
        >
          {repairing ? "检查中..." : "查看整理建议"}
        </button>
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        系统只整理缺失字段和轻量格式问题；不会改写剧情。检查后可查看整理建议，再决定是否应用。
      </p>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">结构检查</div>
          <div className={`mt-1 ${validationTone}`}>{validationSummary(validation)}</div>
        </div>
        <div className="rounded-md border border-zinc-200 p-3">
          <div className="font-medium">导出</div>
          <div className={exportBlocked ? "mt-1 text-red-700" : "mt-1 text-emerald-700"}>
            {exportBlocked ? `暂不能导出：${exportBlockedReason}` : "可以导出"}
          </div>
        </div>
      </div>

      {needsRevision ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          剧本初稿还不足以支撑目标时长：建议补足自然场景过程、氛围描写、动作推进、对白潜台词和动作配合后再作为成品处理。
        </div>
      ) : null}

      {validation && validation.errors.length > 0 ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">必须处理</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
            {validation.errors.map((err, index) => (
              <li key={`${err.path}-${index}`}>
                <span className="text-xs">问题位置：{formatValidationPath(err.path)}</span> — {userFacingIssueMessage(err)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {validation && validation.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">建议完善</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-700">
            {validation.warnings.map((warning, index) => (
              <li key={`${warning.path}-${index}`}>
                <span className="text-xs">问题位置：{formatValidationPath(warning.path)}</span> — {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {repairResult ? (
        <div className={`mt-4 rounded-md border p-3 text-sm ${repairResult.status === "ok" ? "border-emerald-200 bg-emerald-50" : repairResult.status === "partial" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">整理建议</p>
            <span className="text-xs text-zinc-600">{repairResult.appliedFixes.length > 0 ? `可整理 ${repairResult.appliedFixes.length} 项` : "暂无可直接整理项"}</span>
          </div>
          {repairResult.appliedFixes.length === 0 ? (
            <p className="mt-2 text-zinc-700">暂未发现可直接整理的问题。</p>
          ) : null}
          {repairResult.appliedFixes.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-700">
              {repairResult.appliedFixes.map((fix, index) => (
                <li key={`${fix.path}-${index}`}>
                  <span className="mr-1 rounded bg-white px-1 text-xs">整理位置：{formatValidationPath(fix.path)}</span>{userFacingIssueMessage(fix)}
                </li>
              ))}
            </ul>
          ) : null}
          {repairResult.diagnostics.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-red-700">
              {repairResult.diagnostics.slice(0, 8).map((item, index) => (
                <li key={`${item.path}-${index}`}>
                  <span className="mr-1 rounded bg-white px-1 text-xs">问题位置：{formatValidationPath(item.path)}</span>{userFacingIssueMessage(item)}
                </li>
              ))}
            </ul>
          ) : null}
          {repairResult.document && repairResult.appliedFixes.length > 0 ? (
            <button className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700" onClick={onApplyRepair} type="button">
              应用 {repairResult.appliedFixes.length} 项整理
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
