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
          "flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-border bg-secondary/60 px-4 py-3 text-left transition-colors hover:bg-secondary",
          isDragging && "border-primary bg-accent"
        )}
      >
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <UploadCloud className="size-4" />
          Drag &amp; drop or click to upload
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
                className="shrink-0 text-muted-foreground hover:text-foreground"
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
