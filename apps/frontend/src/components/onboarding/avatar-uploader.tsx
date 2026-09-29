"use client";

import * as React from "react";
import { BriefcaseBusiness, Code2, Palette, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const AVATARS = [
  { id: "classic", label: "Classic", Icon: UserRound, className: "bg-violet-100 text-violet-700" },
  { id: "creative", label: "Creative", Icon: Palette, className: "bg-rose-100 text-rose-700" },
  { id: "builder", label: "Builder", Icon: Code2, className: "bg-sky-100 text-sky-700" },
  { id: "professional", label: "Professional", Icon: BriefcaseBusiness, className: "bg-emerald-100 text-emerald-700" },
] as const;

type AvatarSelectorProps = {
  label?: string;
  onAvatarChange?: (avatarId: string) => void;
};

export function AvatarSelector({ label = "Choose your avatar", onAvatarChange }: AvatarSelectorProps) {
  const [selectedAvatar, setSelectedAvatar] = React.useState("classic");

  function selectAvatar(avatarId: string) {
    setSelectedAvatar(avatarId);
    onAvatarChange?.(avatarId);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-xs text-muted-foreground">{label}</p>
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
      <p className="text-center text-xs text-muted-foreground">Icon avatars only — photo uploads are not available in V1.</p>
    </div>
  );
}
