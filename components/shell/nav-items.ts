// One place for the app's navigation. `short` labels fit a 72px column on a 360px phone.
export const NAV_ITEMS = [
  { href: "/home", label: "Home", short: "Home", icon: "home" },
  { href: "/jobs/new", label: "Tailor My CV", short: "Tailor CV", icon: "tailor", primary: true },
  { href: "/applications", label: "My Applications", short: "Applied", icon: "applications" },
  { href: "/experience", label: "My Experience", short: "Experience", icon: "experience" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "settings" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
