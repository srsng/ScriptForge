import { NextResponse } from "next/server";
import { loadPublicDomainNovelSample } from "@/lib/sample-input";

export const runtime = "nodejs";

export async function GET() {
  const sample = await loadPublicDomainNovelSample();
  return NextResponse.json(sample);
}
