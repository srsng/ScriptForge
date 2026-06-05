import { NextResponse } from "next/server";
import {
  validateScriptForgeDocument,
  validateScriptForgeYaml,
} from "@/lib/schema";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  // Accept {yamlText} for YAML validation
  if (typeof body.yamlText === "string") {
    return NextResponse.json(validateScriptForgeYaml(body.yamlText));
  }

  // Accept {document} or top-level document
  const document = body.document ?? body;
  return NextResponse.json(validateScriptForgeDocument(document));
}
