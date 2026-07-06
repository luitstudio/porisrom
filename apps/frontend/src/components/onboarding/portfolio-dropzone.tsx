"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";

type PortfolioFile = {
  file: File;
  preview: string;
};

type PortfolioDropzoneProps = {
  maxFiles?: number;
  onFilesChange?: (files: File[]) => void;
};

export function PortfolioDropzone({
  maxFiles = 8,
  onFilesChange,
}: PortfolioDropzoneProps) {
  const [items, setItems] = React.useState<PortfolioFile[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const remaining = maxFiles - items.length;
    const next = Array.from(incoming)
      .slice(0, remaining)
      .map((file) => ({ file, preview: URL.createObjectURL(file) }));
    const updated = [...items, ...next];
    setItems(updated);
    onFilesChange?.(updated.map((item) => item.file));
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    onFilesChange?.(updated.map((item) => item.file));
  }

  const canAddMore = items.length < maxFiles;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.preview}
          className="group relative aspect-square overflow-hidden rounded-xl bg-secondary"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.preview}
            alt={`Work sample ${index + 1}`}
            className="size-full object-cover"
          />
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => removeItem(index)}
            className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      {canAddMore && (
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
            "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-secondary/60 text-muted-foreground transition-colors hover:bg-secondary",
            isDragging && "border-primary bg-accent"
          )}
        >
          <Plus className="size-5" />
          <span className="text-[11px] font-medium">Add file</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="sr-only"
        onChange={(e) => addFiles(e.target.files)}
      />
    </div>
  );
}
