import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getActiveAdminSession } from "@/lib/auth/admin";
import { PDF_FILES, type OutreachAttachment } from "@/components/internal-hub/outreach-templates";

export const runtime = "nodejs";

function isOutreachAttachment(value: string): value is OutreachAttachment {
  return Object.prototype.hasOwnProperty.call(PDF_FILES, value);
}

export async function GET(_request: Request, { params }: { params: { attachment: string } }) {
  const session = await getActiveAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const attachment = params.attachment;
  if (!isOutreachAttachment(attachment)) {
    return NextResponse.json({ error: "Adjunto no encontrado." }, { status: 404 });
  }

  const pdf = PDF_FILES[attachment];

  try {
    const buffer = await readFile(path.join(process.cwd(), "docs", pdf.fileName));

    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${pdf.asciiName}"`,
        "Content-Type": "application/pdf"
      }
    });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar el PDF adjunto." }, { status: 500 });
  }
}
