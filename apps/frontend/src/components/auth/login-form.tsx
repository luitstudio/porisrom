"use client";

import * as React from "react";
import Link from "next/link";
import { useActionState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

import { loginAction, type AuthActionState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PendingButtonContent,
  useRegisterAuthPending,
} from "@/components/auth/auth-pending-state";

const initialState: AuthActionState = {};
const LOGIN_LOADING_MESSAGES = [
  "Checking your credentials...",
  "Welcome back.",
  "Loading your workspace...",
  "Preparing your dashboard...",
  "Ready.",
];

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useRegisterAuthPending(isPending, LOGIN_LOADING_MESSAGES);

  React.useEffect(() => {
    if (state.error) {
      emailRef.current?.focus();
    }
  }, [state]);

  return (
    <motion.form
      action={formAction}
      autoComplete="off"
      aria-busy={isPending}
      animate={
        !prefersReducedMotion && state.error
          ? { x: [0, -4, 4, -2, 2, 0] }
          : { x: 0 }
      }
      transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
      className={`flex flex-col gap-5 ${isPending ? "cursor-progress" : ""}`}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <InputGroup className="h-12 rounded-xl">
          <InputGroupInput
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="balamia@gmail.com"
            disabled={isPending}
            required
          />
        </InputGroup>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/auth/forgot-password"
            aria-disabled={isPending}
            className={`text-xs font-medium text-primary hover:underline ${isPending ? "pointer-events-none opacity-50" : ""}`}
          >
            Forgot password?
          </Link>
        </div>
        <InputGroup className="h-12 rounded-xl">
          <InputGroupInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Enter your password"
            disabled={isPending}
            required
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="button"
              size="icon-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isPending}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <motion.div whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          aria-live="polite"
          aria-busy={isPending}
          className="h-13 w-full min-w-0 justify-center rounded-full text-base"
        >
          <PendingButtonContent
            pending={isPending}
            pendingLabel="Authenticating..."
            idleLabel={
              <>
                Log in
                <ArrowRight className="size-4" />
              </>
            }
          />
        </Button>
      </motion.div>
    </motion.form>
  );
}
