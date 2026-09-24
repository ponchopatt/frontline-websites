"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/actions/account";

interface AuthFormProps {
  mode: "signin" | "signup";
  action: (prev: AuthState, form: FormData) => Promise<AuthState>;
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const signup = mode === "signup";
  const field =
    "h-12 w-full rounded-lg border border-input bg-transparent px-3 text-[16px] text-foreground outline-none placeholder:text-faint focus-visible:border-primary/70";

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {signup && (
        <input
          type="hidden"
          name="timezone"
          // Filled in the browser so the first day boundary is right. Server validates it.
          ref={(el) => {
            if (el) el.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
          }}
        />
      )}
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Email
        <input name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={state.email} className={field} />
      </label>
      <label className="grid gap-1.5 text-sm text-muted-foreground">
        Password
        <input
          name="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          required
          minLength={8}
          className={field}
          aria-describedby={signup ? "password-hint" : undefined}
        />
        {signup && (
          <span id="password-hint" className="text-[13px] text-muted-foreground">
            At least 8 characters.
          </span>
        )}
      </label>

      <div aria-live="polite" className="min-h-6 text-[15px]">
        {state.error && <p className="text-primary">{state.error}</p>}
        {state.notice && <p className="text-foreground">{state.notice}</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-full bg-primary text-[15px] font-medium text-primary-foreground transition-opacity disabled:opacity-60"
      >
        {pending ? (signup ? "Creating your account…" : "Signing in…") : signup ? "Create account" : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={signup ? "/login" : "/signup"} className="text-foreground underline underline-offset-4">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
