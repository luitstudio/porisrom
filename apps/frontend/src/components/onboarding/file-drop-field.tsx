"use client";

import * as React from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

type FileDropFieldProps = {
  hint?: string;
  multiple?: boolean;
  accept?: string;
  allowedKinds?: Array<"pdf" | "image">;
  maxSizeBytes?: number;
  fileLabel?: string;
  onFilesChange?: (files: File[]) => void;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropField({
  hint,
  multiple = false,
  accept = ".pdf,image/*",
  allowedKinds = ["pdf", "image"],
  maxSizeBytes,
  fileLabel = "File",
  onFilesChange,
}: FileDropFieldProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function detectFileKind(file: File) {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const isPdf =
      header.length >= 5 &&
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46 &&
      header[4] === 0x2d;
    if (isPdf) return "pdf";

    const isJpeg = header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
    const isPng =
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a;
    const isWebp =
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50;
    if (isJpeg || isPng || isWebp) return "image";
    return null;
  }

  async function validFilesFrom(incoming: FileList | null) {
    const selected = Array.from(incoming ?? []);
    const accepted: File[] = [];

    for (const file of selected) {
      if (maxSizeBytes && file.size > maxSizeBytes) {
        return {
          files: accepted,
          error: `${fileLabel} must be ${formatSize(maxSizeBytes)} or smaller. "${file.name}" is ${formatSize(file.size)}.`,
        };
      }

      const kind = await detectFileKind(file);
      if (!kind || !allowedKinds.includes(kind)) {
        const allowedLabel = allowedKinds.includes("pdf") && allowedKinds.length === 1
          ? "a valid PDF"
          : "a valid JPG, PNG, WebP, or PDF";
        return {
          files: accepted,
          error: `${fileLabel} must be ${allowedLabel}. "${file.name}" does not look like one.`,
        };
      }

      accepted.push(file);
    }

    return { files: accepted, error: null };
  }

  async function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const result = await validFilesFrom(incoming);
    if (result.error) {
      setError(result.error);
      if (!multiple) {
        setFiles([]);
        onFilesChange?.([]);
      }
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const next = multiple ? [...files, ...result.files] : result.files.slice(0, 1);
    setError(null);
    setFiles(next);
    onFilesChange?.(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setError(null);
    setFiles(next);
    onFilesChange?.(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-14 w-full min-w-0 flex-col items-stretch justify-between gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/60 px-3 py-3 text-left transition-colors hover:bg-secondary min-[375px]:flex-row min-[375px]:items-center min-[375px]:px-4",
          isDragging && "border-primary bg-accent",
          error && "border-destructive/60 bg-destructive/5"
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <UploadCloud className="size-4 shrink-0" />
          <span className="min-w-0 break-words">Drag &amp; drop or click to upload</span>
        </span>
        <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          Upload
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => void addFiles(e.target.files)}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2 truncate text-foreground">
                <FileText className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatSize(file.size)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeFile(index)}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
