import type { ValidationResult } from "@/lib/schema";
import { formatValidationPath, userFacingIssueMessage } from "./utils";

type YamlDownloadFormat = "yaml" | "json" | "markdown";

type YamlEditorPanelProps = {
  yamlText: string;
  validation: ValidationResult | null;
  validating: boolean;
  canExport: boolean;
  canApplyYaml: boolean;
  canResetYaml: boolean;
  exportBlocked: boolean;
  exportBlockedReason: string;
  onYamlChange: (value: string) => void;
  onConvertToYaml: () => void;
  onRevalidate: () => void;
  onApplyYamlToJson: () => void;
  onResetYamlDraft: () => void;
  onCopyYaml: () => void;
  onDownload: (format: YamlDownloadFormat) => void;
};

export function YamlEditorPanel({
  yamlText,
  validation,
  validating,
  canExport,
  canApplyYaml,
  canResetYaml,
  exportBlocked,
  exportBlockedReason,
  onYamlChange,
  onConvertToYaml,
  onRevalidate,
  onApplyYamlToJson,
  onResetYamlDraft,
  onCopyYaml,
  onDownload,
}: YamlEditorPanelProps) {
  const validationIssues = validation ? (validation.errors.length > 0 ? validation.errors : validation.warnings) : [];

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">剧本导出</h2>
          <p className="text-sm text-zinc-600">从当前剧本整理出可编辑的 YAML 内容；修改后先确认改动，也可以恢复到上次确认的内容。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 disabled:opacity-50" disabled={!canExport} onClick={onConvertToYaml} type="button">
            生成 YAML 剧本
          </button>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!yamlText.trim() || exportBlocked} onClick={onCopyYaml} type="button">
            复制 YAML
          </button>
          <button className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" disabled={!canExport || exportBlocked} onClick={() => onDownload("yaml")} type="button">
            下载 YAML 编辑稿
          </button>
          {/* <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!canExport || exportBlocked} onClick={() => onDownload("json")} type="button">
            下载 JSON 完整备份
          </button> */}
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!canExport || exportBlocked} onClick={() => onDownload("markdown")} type="button">
            下载 Markdown 阅读稿
          </button>
        </div>
      </div>

      <textarea
        className="min-h-[260px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
        onChange={(event) => onYamlChange(event.target.value)}
        placeholder="点击「生成 YAML 剧本」会把当前剧本整理成方便编辑的 YAML 内容。编辑后需要重新检查。"
        spellCheck={false}
        value={yamlText}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={!yamlText.trim() || validating} onClick={onRevalidate} type="button">
            {validating ? "检查中..." : "重新检查"}
          </button>
          <button className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" disabled={!canApplyYaml || validating} onClick={onApplyYamlToJson} type="button">
            确认改动
          </button>
          <button className="rounded-md border border-amber-500 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50" disabled={!canResetYaml || validating} onClick={onResetYamlDraft} type="button">
            恢复上次确认
          </button>
          {validation ? (
            <span className={`text-sm font-medium ${validation.status === "pass" ? "text-emerald-700" : validation.status === "warn" ? "text-amber-700" : "text-red-700"}`}>
              {validation.status === "pass" ? "检查通过" : validation.status === "warn" ? `通过但有 ${validation.warnings.length} 条提醒` : `发现 ${validation.errors.length} 条问题`}
            </span>
          ) : null}
          {exportBlocked ? <span className="text-sm font-medium text-red-700">暂不能导出：{exportBlockedReason}</span> : null}
        </div>
        <span className="text-sm text-zinc-600">{yamlText ? `${yamlText.length} 字符` : "尚未生成 YAML 内容"}</span>
      </div>

      {validationIssues.length > 0 ? (
        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className={`text-sm font-semibold ${validation?.valid ? "text-amber-700" : "text-red-700"}`}>
            {validation?.valid ? "需要留意的提醒" : "需要修正的问题"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {validationIssues.slice(0, 8).map((issue, index) => (
              <li className="rounded-md border border-zinc-200 bg-white px-3 py-2" key={`${issue.source}-${issue.path}-${issue.message}-${index}`}>
                <span className="text-xs text-zinc-500">问题位置：{formatValidationPath(issue.path)}</span>
                <span className="mx-2 text-zinc-400">·</span>
                <span>{userFacingIssueMessage(issue)}</span>
              </li>
            ))}
          </ul>
          {validationIssues.length > 8 ? <p className="mt-2 text-xs text-zinc-500">还有 {validationIssues.length - 8} 条未显示，请优先修复前面的结构问题。</p> : null}
        </div>
      ) : null}
    </section>
  );
}
