"use client";

import * as React from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

type FileDropFieldProps = {
  hint?: string;
  multiple?: boolean;
  accept?: string;
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
  onFilesChange,
}: FileDropFieldProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const next = multiple
      ? [...files, ...Array.from(incoming)]
      : [Array.from(incoming)[0]];
    setFiles(next);
    onFilesChange?.(next);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
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
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-14 w-full min-w-0 flex-col items-stretch justify-between gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/60 px-3 py-3 text-left transition-colors hover:bg-secondary min-[375px]:flex-row min-[375px]:items-center min-[375px]:px-4",
          isDragging && "border-primary bg-accent"
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
        onChange={(e) => addFiles(e.target.files)}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

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
