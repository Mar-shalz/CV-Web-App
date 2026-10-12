import type { MetadataRoute } from "next";
import { APP, APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest & { share_target: unknown } {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP.promise,
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8fc",
    theme_color: "#1e47d9",
    lang: "en-NG",
    // Android "Share" from WhatsApp, Instagram or a browser sends the job straight in (Slice 3).
    share_target: {
      action: "/jobs/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "file", accept: ["image/*", "application/pdf"] }] },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
