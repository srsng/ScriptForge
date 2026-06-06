import type { ValidationResult } from "@/lib/schema";

type YamlEditorPanelProps = {
  yamlText: string;
  validation: ValidationResult | null;
  validating: boolean;
  canExport: boolean;
  exportBlocked: boolean;
  onYamlChange: (value: string) => void;
  onConvertToYaml: () => void;
  onRevalidate: () => void;
  onCopyYaml: () => void;
  onDownload: (format: "yaml" | "json" | "markdown") => void;
};

export function YamlEditorPanel({
  yamlText,
  validation,
  validating,
  canExport,
  exportBlocked,
  onYamlChange,
  onConvertToYaml,
  onRevalidate,
  onCopyYaml,
  onDownload,
}: YamlEditorPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">YAML 编辑与导出</h2>
          <p className="text-sm text-zinc-600">textarea MVP：可编辑、重新校验、复制，并在校验失败时阻止 YAML 导出。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md border border-cyan-700 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-50 disabled:opacity-50" disabled={!canExport} onClick={onConvertToYaml} type="button">
            生成 YAML
          </button>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!canExport} onClick={onCopyYaml} type="button">
            复制
          </button>
          <button className="rounded-md border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" disabled={!canExport || exportBlocked} onClick={() => onDownload("yaml")} type="button">
            下载 YAML
          </button>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!canExport} onClick={() => onDownload("json")} type="button">
            下载 JSON
          </button>
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50" disabled={!canExport} onClick={() => onDownload("markdown")} type="button">
            下载 MD
          </button>
        </div>
      </div>

      <textarea
        className="min-h-[260px] w-full resize-y bg-white p-4 font-mono text-sm leading-6 outline-none"
        onChange={(event) => onYamlChange(event.target.value)}
        placeholder="点击「生成 YAML」将结果转为稳定字段顺序的 YAML。编辑后需要重新校验。"
        spellCheck={false}
        value={yamlText}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-md bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:bg-zinc-300" disabled={!yamlText.trim() || validating} onClick={onRevalidate} type="button">
            {validating ? "校验中..." : "重新校验"}
          </button>
          {validation ? (
            <span className={`text-sm font-medium ${validation.status === "pass" ? "text-emerald-700" : validation.status === "warn" ? "text-amber-700" : "text-red-700"}`}>
              {validation.status === "pass" ? "校验通过" : validation.status === "warn" ? `通过但有 ${validation.warnings.length} 条警告` : `失败：${validation.errors.length} 条错误`}
            </span>
          ) : null}
          {exportBlocked ? <span className="text-sm font-medium text-red-700">导出已阻止</span> : null}
        </div>
        <span className="text-sm text-zinc-600">{yamlText ? `${yamlText.length} 字符` : "未生成 YAML"}</span>
      </div>
    </section>
  );
}
