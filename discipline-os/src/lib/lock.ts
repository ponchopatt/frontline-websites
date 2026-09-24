import "server-only";
import { cookies, headers } from "next/headers";

/**
 * The passcode lock's cookie: an unlock token the database signed (public.unlock_app), good
 * for 12 hours and for this browser only. It's a session cookie, so closing the app locks it.
 */
export const UNLOCK_COOKIE = "dos_unlock";

export async function readUnlockToken(): Promise<string> {
  return (await cookies()).get(UNLOCK_COOKIE)?.value ?? "";
}

export async function setUnlockToken(token: string): Promise<void> {
  const proto = (await headers()).get("x-forwarded-proto");
  (await cookies()).set(UNLOCK_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: proto === "https",
  });
}

export async function clearUnlockToken(): Promise<void> {
  (await cookies()).delete(UNLOCK_COOKIE);
}

/** A 12-hour unlock token as the database makes it. */
export function isUnlockToken(value: string): boolean {
  return /^[0-9]{1,12}\.[0-9a-f]{64}$/.test(value);
}
