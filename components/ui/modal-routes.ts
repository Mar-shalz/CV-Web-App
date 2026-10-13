// Screens that open over the current page (intercepted routes in app/(app)/@modal).
// One place for their titles, so the instant loading frame and the screen match.
export const MODAL_ROUTES = {
  "/applications/new": { title: "Add an application you already sent", description: "Made your CV somewhere else? Keep it here with the job, and we'll check in and help you prepare when they reply." },
  "/jobs/new": { title: "Tailor your CV to a job", description: "Start with the job description. The more complete it is, the better your CV will match." },
  "/vault/import": { title: "Upload your CV", description: "Got an old CV? Add it here, even a photo of the printout. We pull out what's useful, and you check it." },
  "/vault/interview": { title: "Let's find the wins your CV forgot", description: "One question at a time about one role. Talk or type, like you're telling a friend. Stop whenever you like." },
  "/vault/new": { title: "Add a role", description: "A job, SIWES, NYSC, a campus role, a project, a degree or a certificate. Then add what you did there." },
} as const;

export const MODAL_PATHS = Object.keys(MODAL_ROUTES);
