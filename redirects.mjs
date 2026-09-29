// URLs that moved when app/ was split into the (marketing) and (demo) route groups.
// next.config.mjs serves `redirectMap`; tests/routes.test.ts checks each destination exists
// and that no redirect shadows a page.
//
// Moves with no redirect, because the old URL now serves something else:
//   /  (Palmetto Coast lobby)  ->  /demo.  "/" is the public homepage.

/** @type {Array<{ source: string; destination: string; permanent: boolean; note: string }>} */
export const redirectMap = [];
