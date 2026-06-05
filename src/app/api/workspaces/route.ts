import { NextResponse } from "next/server";
import { createWorkspace, listWorkspaces } from "@/lib/workspace-data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ workspaces: await listWorkspaces() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected JSON object body." }, { status: 400 });
  }

  const result = await createWorkspace(body as Parameters<typeof createWorkspace>[0]);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  return NextResponse.json(result.workspace, { status: 201 });
}
