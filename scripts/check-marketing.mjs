// Acceptance check for the public site: at a 375px viewport, no route may scroll
// horizontally. Run against a running server:
//   APP_BASE_URL=http://localhost:3000 node scripts/check-marketing.mjs
import { chromium } from "playwright";

const base = process.env.APP_BASE_URL || "http://localhost:3000";
const routes = ["/", "/scribe", "/squire", "/pricing", "/ownership", "/faq", "/research", "/founding", "/book", "/legal/privacy", "/legal/terms", "/try"];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let failed = 0;
for (const route of routes) {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  const { scrollWidth, clientWidth, offenders } = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > clientWidth + 1)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth, offenders };
  });
  const ok = response?.ok() && scrollWidth <= clientWidth;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${route} status=${response?.status()} scrollWidth=${scrollWidth} clientWidth=${clientWidth}${offenders.length ? ` offenders=${offenders.join(", ")}` : ""}`);
}
await browser.close();
if (errors.length) console.log("page errors:", errors);
process.exit(failed || errors.length ? 1 : 0);
