import { cookies } from "next/headers";

/**
 * Fake session for the demo: a signed-in flag plus an "internal" marker used to
 * exclude team members' own views from prospect analytics later. No real auth.
 */
const SESSION_COOKIE = "autodeck_session";
const INTERNAL_COOKIE = "autodeck_internal";

export async function setSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  // Not httpOnly on purpose: the tracking script reads it client-side to skip
  // analytics events fired by team members viewing their own share pages.
  store.set(INTERNAL_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
  });
}

export async function isLoggedIn(): Promise<boolean> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value === "1";
}
