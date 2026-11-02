"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadCompanyDocumentsAction } from "@/app/onboarding/actions";

export function CompanyDocumentUploadForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <form className="space-y-3" onSubmit={async (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const certificate = form.get("certificate");
    const aadhaar = form.getAll("aadhaar").filter((value): value is File => value instanceof File && value.size > 0);
    const files = [...(certificate instanceof File && certificate.size > 0 ? [certificate] : []), ...aadhaar];
    if (!files.length || aadhaar.length > 4 || files.some((file) => file.type !== "application/pdf" || file.size > 1024 * 1024)) {
      setMessage("Select at least one PDF, at most one certificate and four Aadhaar files, each 1 MiB or smaller."); return;
    }
    const upload = new FormData();
    if (certificate instanceof File && certificate.size > 0) upload.set("certificate", certificate);
    for (const file of aadhaar) upload.append("aadhaar", file);
    setPending(true); setMessage("");
    try {
      const result = await uploadCompanyDocumentsAction(upload);
      if ("error" in result) setMessage(result.error);
      else { element.reset(); setMessage("Private documents saved. Existing documents of the submitted types were replaced."); router.refresh(); }
    } finally { setPending(false); }
  }}>
    <p>Resume or retry private document submission here. Submitting a type replaces its existing set; unsubmitted types are retained. Select all Aadhaar PDFs you intend to keep. No document is made public.</p>
    <label className="block">Certificate (one PDF, up to 1 MiB)<input name="certificate" type="file" accept="application/pdf" className="block" disabled={pending} /></label>
    <label className="block">Aadhaar (up to four PDFs, 1 MiB each)<input name="aadhaar" type="file" multiple accept="application/pdf" className="block" disabled={pending} /></label>
    <button className="rounded border px-3 py-2" disabled={pending}>{pending ? "Uploading…" : "Submit private documents"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
