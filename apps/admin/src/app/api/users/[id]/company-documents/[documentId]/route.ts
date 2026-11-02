import { NextResponse, type NextRequest } from "next/server";

import { getBackendUrl } from "@/lib/backend-api";
import { getSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id, documentId } = await params;
  const response = await fetch(
    `${getBackendUrl()}/admin/users/${encodeURIComponent(id)}/company-documents/${encodeURIComponent(documentId)}/file`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
      redirect: "follow",
    },
  );

  if (!response.ok || !response.body) {
    return NextResponse.json({ message: "Company document not found" }, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": response.headers.get("content-disposition") ?? 'inline; filename="company-document.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
