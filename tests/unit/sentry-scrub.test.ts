import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/browser";
import { beforeSend, scrubBreadcrumb, scrubText, scrubUrl } from "@/lib/observability/scrub";
import { sentryOptions } from "@/lib/observability/sentry-options";

describe("scrubText", () => {
  it("masks emails and Nigerian and foreign phone numbers", () => {
    expect(scrubText("Contact tolu.a+jobs@gmail.com now")).toBe("Contact [email] now");
    expect(scrubText("Call 08031234567 or +234 803 123 4567 or 0803-123-4567")).toBe(
      "Call [phone] or [phone] or [phone]",
    );
    expect(scrubText("UK: +44 7700 900123")).toBe("UK: [phone]");
  });

  it("leaves dates, times, short numbers and ids alone", () => {
    const text = "Failed at 2026-10-12 14:30:05, status 500, retry 3 of 2, row 12345, id 3f9a1c2b";
    expect(scrubText(text)).toBe(text);
  });
});

describe("scrubUrl", () => {
  it("drops the query string and fragment", () => {
    expect(scrubUrl("https://receipts.ng/sign-in/verify?email=tolu@example.test#code")).toBe(
      "https://receipts.ng/sign-in/verify",
    );
  });
});

describe("beforeSend", () => {
  const event = {
    type: undefined,
    message: "Signup failed for tolu@example.test",
    user: { id: "u1", email: "tolu@example.test", ip_address: "102.89.1.1" },
    request: {
      url: "https://receipts.ng/onboarding/setup?phone=08031234567",
      method: "POST",
      data: { full_name: "Tolu Adeyemi", phone: "08031234567" },
      cookies: { "sb-access-token": "secret" },
      query_string: "phone=08031234567",
      headers: { cookie: "sb=secret", authorization: "Bearer x", "user-agent": "Android", "content-type": "text/html" },
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "Could not reach 0803 123 4567",
          stacktrace: { frames: [{ filename: "app.js", lineno: 3, vars: { email: "tolu@example.test" } }] },
        },
      ],
    },
    breadcrumbs: [
      { category: "console", message: "typed tolu@example.test" },
      { category: "fetch", data: { url: "/api/x?email=tolu@example.test", body: "{\"phone\":\"0803\"}", status_code: 500 } },
    ],
    extra: { note: { nested: ["ring +2348031234567"] } },
    contexts: { form: { email: "tolu@example.test" } },
    tags: { route: "/home" },
  } as unknown as ErrorEvent;

  const out = beforeSend(event);
  const json = JSON.stringify(out);

  it("removes every email and phone number", () => {
    expect(json).not.toContain("tolu@example.test");
    expect(json).not.toContain("08031234567");
    expect(json).not.toContain("0803 123 4567");
    expect(json).not.toContain("2348031234567");
  });

  it("drops request bodies, cookies, query strings and identifying headers", () => {
    expect(out.request).not.toHaveProperty("data");
    expect(out.request).not.toHaveProperty("cookies");
    expect(out.request).not.toHaveProperty("query_string");
    expect(out.request?.headers).toEqual({ "user-agent": "Android", "content-type": "text/html" });
    expect(out.request?.url).toBe("https://receipts.ng/onboarding/setup");
    expect(json).not.toContain("Tolu Adeyemi");
  });

  it("drops the user and stack frame variables", () => {
    expect(out).not.toHaveProperty("user");
    expect(out.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({ filename: "app.js", lineno: 3 });
  });

  it("keeps what is needed to debug", () => {
    expect(out.message).toBe("Signup failed for [email]");
    expect(out.exception?.values?.[0].value).toBe("Could not reach [phone]");
    expect(out.tags).toEqual({ route: "/home" });
    expect(out.breadcrumbs?.[1].data).toEqual({ url: "/api/x", status_code: 500 });
  });

  it("does not change the original event", () => {
    expect(event.user).toBeDefined();
    expect(event.request?.data).toBeDefined();
  });
});

describe("scrubBreadcrumb", () => {
  it("masks messages and navigation URLs", () => {
    expect(scrubBreadcrumb({ message: "hi tolu@example.test", data: { from: "/a?x=1", to: "/b#c" } })).toEqual({
      message: "hi [email]",
      data: { from: "/a", to: "/b" },
    });
  });
});

describe("sentryOptions", () => {
  it("is off without a DSN and never collects personal data at source", () => {
    expect(sentryOptions(undefined).enabled).toBe(false);
    const options = sentryOptions("https://key@o1.ingest.de.sentry.io/1");
    expect(options.enabled).toBe(true);
    expect(options.tracesSampleRate).toBe(0);
    expect(options.dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    });
  });
});
