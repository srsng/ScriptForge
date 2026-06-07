import { NextResponse } from "next/server";
import { getWorkspace, saveWorkspaceState } from "@/lib/workspace-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const workspace = await getWorkspace(id);
    if (!workspace) {
      return NextResponse.json({ error: "没有找到这个工作区，请返回列表重新打开。" }, { status: 404 });
    }
    return NextResponse.json(workspace);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "请求内容不完整，请刷新页面后重试。" }, { status: 400 });
  }

  try {
    const input = body as Record<string, unknown>;
    const result = input.state !== undefined
      ? await saveWorkspaceState(id, body as Parameters<typeof saveWorkspaceState>[1])
      : { ok: false as const, status: 400, error: "保存内容不完整，请重新打开工作区后再试。" };
    if (!result.ok) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json(result.workspace);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
