import { formatDate } from "./utils";

export type WorkspaceIndexEntry = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  chapter_count: number;
  request_path: string;
  result_path?: string;
};

type WorkspaceListProps = {
  workspaces: WorkspaceIndexEntry[];
  onRefresh: () => void;
  onLoadWorkspace: (id: string) => void;
};

export function WorkspaceList({ workspaces, onRefresh, onLoadWorkspace }: WorkspaceListProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">已保存工作区</h2>
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50" onClick={onRefresh} type="button">
          刷新
        </button>
      </div>
      <div className="mt-3 max-h-[640px] space-y-2 overflow-auto">
        {workspaces.length === 0 ? <p className="text-sm text-zinc-600">暂无保存记录</p> : null}
        {workspaces.map((workspace) => (
          <button
            className="w-full rounded-md border border-zinc-200 p-3 text-left hover:border-cyan-700 hover:bg-cyan-50"
            key={workspace.id}
            onClick={() => onLoadWorkspace(workspace.id)}
            type="button"
          >
            <div className="font-medium">{workspace.title}</div>
            <div className="mt-1 text-sm text-zinc-600">{workspace.chapter_count} 章 · {formatDate(workspace.updated_at)}</div>
            <div className="mt-1 text-xs text-zinc-500">{workspace.result_path ? "已有结果" : "仅输入"}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
