"use client";

import * as React from "react";
import { Camera, User } from "lucide-react";

import { cn } from "@/lib/utils";

type AvatarUploaderProps = {
  label?: string;
  onFileChange?: (file: File | null) => void;
};

export function AvatarUploader({
  label = "Upload your profile photo",
  onFileChange,
}: AvatarUploaderProps) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    onFileChange?.(file);
  }

  return (
    <div className="flex flex-col items-center gap-3">
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
          handleFile(e.dataTransfer.files?.[0]);
        }}
        aria-label={label}
        className={cn(
          "group relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary text-muted-foreground transition-colors",
          isDragging && "border-primary bg-accent",
          preview && "border-solid border-transparent"
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Profile preview"
            className="size-full object-cover"
          />
        ) : (
          <User className="size-8" />
        )}

        <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-opacity group-hover:bg-foreground/40 group-hover:opacity-100">
          <Camera className="size-5 text-white" />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
