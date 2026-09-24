import type { Metadata } from "next";
import { signIn } from "@/app/actions/account";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-2 text-[40px] leading-[1.05] font-light tracking-[-0.035em]">Start the day right.</h1>
      <p className="mb-8 text-[15px] text-muted-foreground">Sign in to pick up where you left off.</p>
      <AuthForm mode="signin" action={signIn} />
    </>
  );
}
