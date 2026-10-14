// Where to go after signing in, for the few screens that send people to sign in and expect
// them back (D-144). Only these fixed paths, never an address from the request.
export const NEXT_COOKIE = "rcpt_next";
export const RETURN_PATHS = ["/extension/connect"] as const;
export const isReturnPath = (v: string | undefined | null): v is (typeof RETURN_PATHS)[number] => Boolean(v && (RETURN_PATHS as readonly string[]).includes(v));
