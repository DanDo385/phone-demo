// Every URL that moved when app/ was split into the (marketing) and (demo) route groups.
// next.config.mjs serves these; tests/routes.test.ts checks each destination exists.
// Route groups do not change URLs, so only the Palmetto lobby moved: "/" now belongs to
// the public site.
//
// `temporary` entries are placeholders until the public page exists. Delete an entry when
// app/(marketing) gains a page at its source, or the redirect will shadow that page.

/** @type {Array<{ source: string; destination: string; permanent: boolean; note: string }>} */
export const redirectMap = [
  {
    source: "/",
    destination: "/demo",
    permanent: false,
    note: "temporary: Palmetto lobby moved to /demo; remove when app/(marketing)/page.tsx lands",
  },
];
