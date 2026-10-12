import { APP_NAME } from "@/lib/config";

// A verified seal with a tick: proof, the idea the product is built on. It carries
// no letters and no reference to the working name, so a rename only changes the
// wordmark (APP_NAME in config/app.json).
const SEAL = "M16 4.6L17 4.9L17.8 5.8L18.5 6.6L19.2 7.2L20.1 7.2L21.2 7L22.4 6.9L23.3 7.3L23.9 8.1L24 9.3L23.9 10.4L24.1 11.3L24.8 11.9L25.8 12.4L26.7 13.1L27.2 14L27.1 15L26.4 16L25.7 16.8L25.3 17.6L25.4 18.5L25.8 19.6L26.1 20.7L25.9 21.7L25.1 22.4L24 22.7L22.9 22.9L22 23.2L21.6 23.9L21.2 25L20.7 26.1L19.9 26.7L18.9 26.7L17.8 26.2L16.8 25.7L16 25.4L15.2 25.7L14.2 26.2L13.1 26.7L12.1 26.7L11.3 26.1L10.8 25L10.4 23.9L10 23.2L9.1 22.9L8 22.7L6.9 22.4L6.1 21.7L5.9 20.7L6.2 19.6L6.6 18.5L6.7 17.6L6.3 16.8L5.6 16L4.9 15L4.8 14L5.3 13.1L6.2 12.4L7.2 11.9L7.9 11.3L8.1 10.4L8 9.3L8.1 8.1L8.7 7.3L9.6 6.9L10.8 7L11.9 7.2L12.8 7.2L13.5 6.6L14.2 5.8L15 4.9Z";

export function Mark({ size = 32, tone = "brand" }: { size?: number; tone?: "brand" | "onDark" }) {
  // The tile is a CSS gradient, not an SVG <linearGradient>: a gradient id shared by
  // several marks breaks when the first one sits in a hidden element (the sidebar on phones).
  return (
    <span
      aria-hidden="true"
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden ${
        tone === "brand" ? "bg-gradient-to-br from-brand-500 to-brand-900" : "border border-white/35 bg-white/20"
      }`}
      style={{ width: size, height: size, borderRadius: size * 0.31 }}
    >
      <svg width={size} height={size} viewBox="0 0 32 32" focusable="false" className="absolute inset-0">
        <path d={SEAL} fill="#ffffff" />
        <path d="m11.6 16.2 3 3 5.8-6.2" fill="none" stroke="#1e47d9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ tone = "brand", size = 34, collapsed = false }: { tone?: "brand" | "onDark"; size?: number; collapsed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} tone={tone} />
      {collapsed ? (
        <span className="sr-only">{APP_NAME}</span>
      ) : (
        <span className={`font-display text-[1.3125rem] font-semibold tracking-[-0.02em] ${tone === "onDark" ? "text-white" : "text-brand-900"}`}>{APP_NAME}</span>
      )}
    </span>
  );
}
