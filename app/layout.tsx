import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import localFont from "next/font/local";
import { Urbanist } from "next/font/google";
import { APP, APP_NAME } from "@/lib/config";
import { Suspense } from "react";
import { ServiceWorker } from "@/components/shell/service-worker";
import { NavProgress } from "@/components/shell/nav-progress";
import "./globals.css";

// Lufga is the product font (founder's choice, D-018). These are the vendor's DEMO
// files: they replace 30 characters (all symbols, the hyphen and the digit 4) with a
// "DEMO" watermark, so the subset keeps letters and . , : ; ? only (about 5KB a weight).
// Everything else falls through to Urbanist. Swap in licensed files before launch.
const lufga = localFont({
  variable: "--font-lufga",
  display: "swap",
  src: [
    { path: "./fonts/lufga-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/lufga-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/lufga-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/lufga-700.woff2", weight: "700", style: "normal" },
  ],
});

// Fallback for every glyph Lufga lacks (digits, symbols, ₦, curly quotes) and the
// font of record if Lufga fails to load. One variable file covers all weights.
const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: `${APP_NAME}: ${APP.tagline}`, template: `%s · ${APP_NAME}` },
  description: APP.promise,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1e47d9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page renders per request so it can carry this request's CSP nonce (lib/csp.ts).
  await connection();
  return (
    <html lang="en-NG" className={`${lufga.variable} ${urbanist.variable} h-full`}>
      <body className="min-h-full">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-semibold focus:text-brand-700 focus:shadow-raised"
        >
          Skip to content
        </a>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
