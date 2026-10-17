// One place for the app's navigation. `short` labels fit a 72px column on a 360px phone.
export const NAV_ITEMS = [
  { href: "/home", label: "Home", short: "Home", icon: "home" },
  { href: "/jobs/new", label: "Tailor My CV", short: "Tailor CV", icon: "tailor", primary: true },
  { href: "/applications", label: "My Applications", short: "Applied", icon: "applications" },
  { href: "/experience", label: "My Experience", short: "Experience", icon: "experience" },
  // "Not sure a job is real? Check it first, free" (founder, round 23). Named with the
  // question people ask themselves (round 24, D-180). Sidebar only: phones get a floating button on Home.
  { href: "/jobs/real", label: "Is This Job Real?", short: "Job real?", icon: "check", badge: "Free", sidebarOnly: true },
  { href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
