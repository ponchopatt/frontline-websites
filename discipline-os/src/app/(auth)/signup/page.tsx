import type { Metadata } from "next";
import { signUp } from "@/app/actions/account";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-2 text-[40px] leading-[1.05] font-light tracking-[-0.035em]">Five questions a day.</h1>
      <p className="mb-8 text-[15px] text-muted-foreground">
        Did I start right? Did I seek God? Did I do the work? Did I look after my body? Did I keep my word?
      </p>
      <AuthForm mode="signup" action={signUp} />
    </>
  );
}
