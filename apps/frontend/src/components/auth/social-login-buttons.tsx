import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuthPending } from "@/components/auth/auth-pending-state";

const PROVIDERS = [
  { label: "Google", icon: GoogleIcon },
  { label: "Apple", icon: AppleIcon },
];

export function SocialLoginButtons({ disabled = false }: { disabled?: boolean }) {
  const { isPending } = useAuthPending();
  const isDisabled = disabled || isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        {PROVIDERS.map(({ label, icon: Icon }) => (
          <Button
            key={label}
            type="button"
            variant="outline"
            disabled
            title="Coming soon"
            aria-label={`Continue with ${label} (coming soon)`}
            className={`h-12 w-full justify-center gap-2 rounded-xl text-sm transition-opacity ${isDisabled ? "opacity-45" : ""}`}
          >
            <Icon className="size-4" />
            <span className="truncate">Continue with {label}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Or
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.86c2.26-2.09 3.58-5.17 3.58-8.87Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.92-2.91l-3.86-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a11.98 11.98 0 0 0 0 10.74l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.27 6.63l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.36 1.43c.1 1.02-.27 2-.86 2.74-.62.78-1.66 1.4-2.7 1.32-.12-1 .33-2.04.92-2.74.65-.78 1.74-1.36 2.64-1.32ZM20.7 17.2c-.32.74-.7 1.43-1.16 2.07-.63.88-1.15 1.49-1.55 1.83-.62.57-1.28.86-1.99.88-.51 0-1.12-.15-1.84-.45-.72-.3-1.38-.45-1.98-.45-.63 0-1.31.15-2.04.45-.73.3-1.32.46-1.77.47-.68.03-1.36-.27-2.03-.9-.42-.36-.97-1-1.63-1.91-.71-.97-1.3-2.09-1.76-3.38-.49-1.39-.74-2.74-.74-4.04 0-1.49.32-2.78.97-3.86a5.68 5.68 0 0 1 2.04-2.08 5.45 5.45 0 0 1 2.76-.78c.59 0 1.36.18 2.32.55.95.37 1.56.56 1.83.56.2 0 .77-.21 1.71-.63.89-.39 1.64-.55 2.26-.49 1.67.14 2.92.79 3.76 1.97-1.49.9-2.23 2.16-2.21 3.78.01 1.26.46 2.31 1.34 3.14.4.38.84.68 1.34.89-.1.31-.22.61-.34.9Z" />
    </svg>
  );
}
