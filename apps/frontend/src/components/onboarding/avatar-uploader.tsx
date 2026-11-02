"use client";

import * as React from "react";
import { BriefcaseBusiness, Code2, ImagePlus, Palette, UploadCloud, UserRound, X } from "lucide-react";

import { cn } from "@/lib/utils";

const MAX_PROFILE_PHOTO_BYTES = 1024 * 1024;

const AVATARS = [
  { id: "classic", label: "Classic", Icon: UserRound, className: "bg-violet-100 text-violet-700" },
  { id: "creative", label: "Creative", Icon: Palette, className: "bg-rose-100 text-rose-700" },
  { id: "builder", label: "Builder", Icon: Code2, className: "bg-sky-100 text-sky-700" },
  { id: "professional", label: "Professional", Icon: BriefcaseBusiness, className: "bg-emerald-100 text-emerald-700" },
] as const;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AvatarSelectorProps = {
  label?: string;
  value?: File | null;
  previewUrl?: string | null;
  onAvatarChange?: (avatarId: string) => void;
  onPhotoChange?: (file: File | null) => void;
};

export function AvatarSelector({
  label = "Profile photo",
  value = null,
  previewUrl = null,
  onAvatarChange,
  onPhotoChange,
}: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = React.useState("classic");
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const selectedAvatarOption = AVATARS.find(({ id }) => id === selectedAvatar) ?? AVATARS[0];
  const SelectedIcon = selectedAvatarOption.Icon;
  const localPreviewUrl = React.useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  const photoPreviewUrl = localPreviewUrl ?? previewUrl;

  React.useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  function selectAvatar(avatarId: string) {
    setSelectedAvatar(avatarId);
    onAvatarChange?.(avatarId);
  }

  async function detectImageFormat(file: File) {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
    if (
      header.length >= 8 &&
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47 &&
      header[4] === 0x0d &&
      header[5] === 0x0a &&
      header[6] === 0x1a &&
      header[7] === 0x0a
    ) {
      return "png";
    }
    if (
      header.length >= 12 &&
      header[0] === 0x52 &&
      header[1] === 0x49 &&
      header[2] === 0x46 &&
      header[3] === 0x46 &&
      header[8] === 0x57 &&
      header[9] === 0x45 &&
      header[10] === 0x42 &&
      header[11] === 0x50
    ) {
      return "webp";
    }
    return null;
  }

  async function selectPhoto(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setError(`Profile photo must be ${formatSize(MAX_PROFILE_PHOTO_BYTES)} or smaller. "${file.name}" is ${formatSize(file.size)}.`);
      onPhotoChange?.(null);
      return;
    }
    if (!(await detectImageFormat(file))) {
      setError(`"${file.name}" is not a valid JPG, PNG, or WebP image. Try downloading or exporting the original image again.`);
      onPhotoChange?.(null);
      return;
    }

    setError(null);
    onPhotoChange?.(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function clearPhoto() {
    setError(null);
    onPhotoChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-xs text-muted-foreground">{label}</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void selectPhoto(event.dataTransfer.files);
        }}
        className={cn(
          "relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-secondary/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDragging && "border-primary bg-accent",
        )}
        aria-label="Upload profile photo"
      >
        {photoPreviewUrl ? (
          <span
            aria-hidden="true"
            className="size-full bg-cover bg-center"
            style={{ backgroundImage: `url("${photoPreviewUrl}")` }}
          />
        ) : (
          <SelectedIcon className="size-9" aria-hidden="true" />
        )}
        <span className="absolute bottom-1 right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <ImagePlus className="size-3.5" aria-hidden="true" />
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void selectPhoto(event.target.files)}
      />

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UploadCloud className="size-3.5" aria-hidden="true" />
          Upload photo
        </button>
        {value && (
          <button
            type="button"
            onClick={clearPhoto}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3.5" aria-hidden="true" />
            Remove
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {AVATARS.map(({ id, label: avatarLabel, Icon, className }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selectedAvatar === id}
            aria-label={`Choose ${avatarLabel} avatar`}
            onClick={() => selectAvatar(id)}
            className={cn(
              "flex min-h-11 min-w-11 items-center justify-center rounded-xl border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
              selectedAvatar === id ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-center text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">JPG, PNG, or WebP up to 1 MB.</p>
      )}
    </div>
  );
}
