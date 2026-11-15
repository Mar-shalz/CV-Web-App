// Where to go after signing in, for the few screens that send people to sign in and expect
// them back (D-144). Only these fixed paths, never an address from the request. The landing
// page's starting points are here too (founder round 50): someone who came to add an
// application lands on that form, not on Home.
export const NEXT_COOKIE = "rcpt_next";
export const RETURN_PATHS = ["/extension/connect", "/applications/new", "/jobs/real", "/matches", "/extension"] as const;
export const isReturnPath = (v: string | undefined | null): v is (typeof RETURN_PATHS)[number] => Boolean(v && (RETURN_PATHS as readonly string[]).includes(v));
