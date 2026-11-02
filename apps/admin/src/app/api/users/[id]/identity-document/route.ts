import { NextResponse, type NextRequest } from "next/server";

import { getBackendUrl } from "@/lib/backend-api";
import { getSession } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const response = await fetch(`${getBackendUrl()}/admin/users/${encodeURIComponent(id)}/identity-document/file`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok || !response.body) {
    return NextResponse.json({ message: "Identity document not found" }, { status: response.status });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/pdf",
      "Content-Disposition": response.headers.get("content-disposition") ?? 'inline; filename="identity-document.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
