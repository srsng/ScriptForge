import { NextResponse } from "next/server";
import { loadQuanZhiGaoShouSample } from "@/lib/sample-input";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chapters = Number.parseInt(searchParams.get("chapters") ?? "3", 10);

  try {
    const sample = await loadQuanZhiGaoShouSample(chapters);
    return NextResponse.json(sample);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
