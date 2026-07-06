"use client";

import * as React from "react";
import { useActionState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

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
  const emailRef = React.useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useRegisterAuthPending(isPending, SIGNUP_LOADING_MESSAGES);

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
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="off"
          placeholder="Enter your full name"
          disabled={isPending}
          required
          className="h-12 rounded-xl"
        />
      </div>

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

      <label
        className={`flex items-start gap-3 rounded-xl bg-accent p-3.5 ${isPending ? "cursor-progress opacity-75" : "cursor-pointer"}`}
      >
        <Checkbox
          checked={acceptedTerms}
          onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
          disabled={isPending}
          className="mt-0.5 size-5 rounded-md border-primary/35 bg-white text-white shadow-sm data-checked:border-primary data-checked:bg-primary"
        />
        <span className="text-sm text-accent-foreground">
          I agree to Porishrom&apos;s Terms of Service and Privacy Policy.
        </span>
      </label>

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
