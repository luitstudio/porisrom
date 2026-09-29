"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BriefcaseBusiness, Check, Eye, EyeOff, UserRound } from "lucide-react";

import { signupAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PendingButtonContent,
  useRegisterAuthPending,
} from "@/components/auth/auth-pending-state";
import { useSignupRole } from "@/components/auth/signup-role-context";

const initialState: AuthActionState = {};
const SIGNUP_LOADING_MESSAGES = [
  "Creating your Porishrom account...",
  "Securing your workspace...",
  "Setting up your profile...",
  "Preparing onboarding...",
  "Welcome to Porishrom.",
];

export function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupAction, initialState);
  const [showPassword, setShowPassword] = React.useState(false);
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<
    Partial<Record<"name" | "email" | "password" | "terms", string>>
  >({});
  const { role, setRole } = useSignupRole();
  const emailRef = React.useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useRegisterAuthPending(isPending, SIGNUP_LOADING_MESSAGES);

  React.useEffect(() => {
    if (state.error) {
      const firstInvalidField = document.querySelector<HTMLElement>(
        "#signup-form [aria-invalid='true']"
      );
      firstInvalidField?.focus();
    }
  }, [state]);

  const validateField = React.useCallback((name: string, value: string) => {
    if (name === "name") {
      return value.trim().length >= 2 ? undefined : "Enter your full name.";
    }
    if (name === "email") {
      if (!value.trim()) return "Enter your email address.";
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ? undefined
        : "Enter a valid email address.";
    }
    if (name === "password") {
      if (!value) return "Enter a password.";
      return value.length >= 8 ? undefined : "Password must be at least 8 characters.";
    }
    return undefined;
  }, []);

  function updateFieldError(name: "name" | "email" | "password", value: string) {
    setFieldErrors((current) => ({ ...current, [name]: validateField(name, value) }));
  }

  function validateBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const formData = new FormData(form);
    const nextErrors = {
      name: validateField("name", String(formData.get("name") ?? "")),
      email: validateField("email", String(formData.get("email") ?? "")),
      password: validateField("password", String(formData.get("password") ?? "")),
      terms: acceptedTerms ? undefined : "Accept the Terms of Service and Privacy Policy to continue.",
    };

    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      event.preventDefault();
      window.requestAnimationFrame(() => {
        form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      });
    }
  }

  const visibleErrors = { ...fieldErrors, ...state.fieldErrors };

  return (
    <motion.form
      action={formAction}
      id="signup-form"
      onSubmit={validateBeforeSubmit}
      autoComplete="off"
      aria-busy={isPending}
      animate={
        !prefersReducedMotion && state.error
          ? { x: [0, -4, 4, -2, 2, 0] }
          : { x: 0 }
      }
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
      className={`flex min-w-0 flex-col gap-5 ${isPending ? "cursor-progress" : ""}`}
    >
      <fieldset className="min-w-0 space-y-2.5">
        <legend className="text-sm font-medium text-foreground">I&apos;m signing up as</legend>
        <input type="hidden" name="role" value={role} />
        <div className="grid grid-cols-2 gap-2 min-[375px]:gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setRole("freelancer")}
            aria-pressed={role === "freelancer"}
            className={`relative flex min-h-16 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-semibold outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 min-[375px]:px-3 ${
              role === "freelancer"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                : "border-border bg-transparent text-muted-foreground hover:bg-accent"
            }`}
          >
            <UserRound className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">Freelancer</span>
            {role === "freelancer" && <Check className="absolute right-2 top-2 size-3.5" />}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setRole("client")}
            aria-pressed={role === "client"}
            className={`relative flex min-h-16 min-w-0 items-center gap-2 rounded-xl border px-2.5 text-left text-sm font-semibold outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50 min-[375px]:px-3 ${
              role === "client"
                ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                : "border-border bg-transparent text-muted-foreground hover:bg-accent"
            }`}
          >
            <BriefcaseBusiness className="size-5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">Client</span>
            {role === "client" && <Check className="absolute right-2 top-2 size-3.5" />}
          </button>
        </div>
      </fieldset>

      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder={role === "client" ? "Your name or company contact" : "Enter your full name"}
          disabled={isPending}
          required
          aria-invalid={Boolean(visibleErrors.name)}
          aria-describedby={visibleErrors.name ? "name-error" : undefined}
          onBlur={(event) => updateFieldError("name", event.currentTarget.value)}
          onChange={(event) => {
            if (fieldErrors.name) updateFieldError("name", event.currentTarget.value);
          }}
          className="h-12 rounded-xl px-3.5"
        />
        {visibleErrors.name && (
          <p id="name-error" className="text-xs font-medium text-destructive" role="alert">
            {visibleErrors.name}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <InputGroup className="h-12 rounded-xl">
          <InputGroupInput
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            disabled={isPending}
            required
            aria-invalid={Boolean(visibleErrors.email)}
            aria-describedby={visibleErrors.email ? "email-error" : undefined}
            onBlur={(event) => updateFieldError("email", event.currentTarget.value)}
            onChange={(event) => {
              if (fieldErrors.email) updateFieldError("email", event.currentTarget.value);
            }}
            className="px-3.5"
          />
        </InputGroup>
        {visibleErrors.email && (
          <p id="email-error" className="text-xs font-medium text-destructive" role="alert">
            {visibleErrors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <InputGroup className="h-12 rounded-xl">
          <InputGroupInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your password"
            disabled={isPending}
            minLength={8}
            required
            aria-invalid={Boolean(visibleErrors.password)}
            aria-describedby={
              visibleErrors.password
                ? "password-requirement password-error"
                : "password-requirement"
            }
            onBlur={(event) => updateFieldError("password", event.currentTarget.value)}
            onChange={(event) => {
              if (fieldErrors.password) updateFieldError("password", event.currentTarget.value);
            }}
            className="pl-3.5"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              disabled={isPending}
              onClick={() => setShowPassword((value) => !value)}
              className="size-11 rounded-lg"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <p id="password-requirement" className="text-xs text-muted-foreground">
          Use at least 8 characters.
        </p>
        {visibleErrors.password && (
          <p id="password-error" className="text-xs font-medium text-destructive" role="alert">
            {visibleErrors.password}
          </p>
        )}
      </div>

      <label
        className={`flex min-h-14 items-start gap-3 rounded-xl border p-3.5 outline-none transition-colors focus-within:ring-3 focus-within:ring-ring/50 ${visibleErrors.terms ? "border-destructive bg-destructive/5" : "border-transparent bg-accent"} ${isPending ? "cursor-progress opacity-75" : "cursor-pointer"}`}
      >
        <Checkbox
          checked={acceptedTerms}
          onCheckedChange={(checked) => {
            const isChecked = checked === true;
            setAcceptedTerms(isChecked);
            setFieldErrors((current) => ({
              ...current,
              terms: isChecked ? undefined : current.terms,
            }));
          }}
          disabled={isPending}
          aria-invalid={Boolean(visibleErrors.terms)}
          aria-describedby={visibleErrors.terms ? "terms-error" : undefined}
          className="mt-0.5 size-5 rounded-md border-primary/35 bg-white text-white shadow-sm data-checked:border-primary data-checked:bg-primary"
        />
        <span className="text-sm leading-5 text-accent-foreground">
          I agree to Porishrom&apos;s{" "}
          <Link href="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/terms#privacy-data-protection"
            className="font-semibold text-primary underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      {visibleErrors.terms && (
        <p id="terms-error" className="-mt-3 text-xs font-medium text-destructive" role="alert">
          {visibleErrors.terms}
        </p>
      )}

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !acceptedTerms}
          aria-live="polite"
          aria-busy={isPending}
          className="h-13 w-full min-w-0 justify-center rounded-full text-base"
        >
          <PendingButtonContent
            pending={isPending}
            pendingLabel="Creating account..."
            idleLabel={
              <>
                Create account
                <ArrowRight className="size-4" />
              </>
            }
          />
        </Button>
      </motion.div>
    </motion.form>
  );
}
