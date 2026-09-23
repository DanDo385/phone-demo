import { chromium } from "playwright";
import fs from "node:fs";

const base = process.env.APP_BASE_URL || "http://localhost:3456";
const out = new URL("../docs/screenshots/", import.meta.url);
fs.mkdirSync(out, { recursive: true });

const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "alex.rivera@palmetto-coast.demo", password: process.env.DEMO_OWNER_PASSWORD || "palmetto-demo" }),
});
const cookie = login.headers.getSetCookie?.()[0] || login.headers.get("set-cookie");
const scenario = await fetch(`${base}/api/scenarios`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookie.split(";")[0] },
  body: JSON.stringify({ scenario: "en" }),
});
const { inquiryId } = await scenario.json();
await fetch(`${base}/api/owner/inquiries/${inquiryId}/complete`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookie.split(";")[0] },
  body: "{}",
});
await fetch(`${base}/api/owner/clock`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie: cookie.split(";")[0] },
  body: JSON.stringify({ inquiryId }),
});
const view = await fetch(`${base}/api/inquiries/${inquiryId}`, { headers: { cookie: cookie.split(";")[0] } }).then((r) => r.json());
const continuation = view.emails.find((email) => email.kind === "continuation").text_body.match(/\/c\/(\S+)/)[1];
const review = view.emails.find((email) => email.kind === "review").text_body.match(/\/review\/(\S+)/)[1].split("?")[0];

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
await context.addCookies([{ name: "palmetto_owner", value: cookie.split(";")[0].split("=")[1], url: base }]);
const page = await context.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(`${base}/dashboard/inquiries/${inquiryId}`);
await page.getByText("Customer journey").waitFor();
await page.screenshot({ path: new URL("01-six-stages-desktop.png", out).pathname, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: new URL("03-six-stages-mobile.png", out).pathname, fullPage: true });
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(`${base}/call`);
await page.getByRole("button", { name: "Start simulated browser voice" }).click();
await page.getByText("simulated receptionist").waitFor();
await page.screenshot({ path: new URL("04-browser-voice.png", out).pathname, fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/c/${continuation}`);
await page.getByRole("heading").waitFor();
await page.screenshot({ path: new URL("05-continuation-mobile.png", out).pathname, fullPage: true });
await page.goto(`${base}/review/${review}?platform=google`);
await page.getByRole("heading").waitFor();
await page.screenshot({ path: new URL("06-review-preview-mobile.png", out).pathname, fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${base}/`);
await page.screenshot({ path: new URL("07-home.png", out).pathname, fullPage: true });
console.log(JSON.stringify({ inquiryId, errors, stages: view.stages.map((s) => s.status) }));
await browser.close();
