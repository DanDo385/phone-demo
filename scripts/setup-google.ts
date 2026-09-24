// One-time Google Calendar authorization. Mints a refresh token and stores it in 1Password.
//
//   op run --env-file=.env.op -- npm run setup:google
//
// Sign in as the calendar owner (dan@magro.dev). The token is written to the
// refresh_token field of GOOGLE_OP_ITEM and is never printed.
import crypto from "node:crypto";
import http from "node:http";
import { execFileSync, spawn } from "node:child_process";

const PORT = Number(process.env.GOOGLE_AUTH_PORT || 53682);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const LOGIN_HINT = process.env.GOOGLE_LOGIN_HINT || "dan@magro.dev";
const OP_VAULT = process.env.GOOGLE_OP_VAULT || "Dev";
const OP_ITEM = process.env.GOOGLE_OP_ITEM || "o52saizwfwcbyf6ejbz7gsbe7u";
// FreeBusy, then insert, is all lib/providers/google.ts does.
const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const calendarId = process.env.GOOGLE_CALENDAR_ID;

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

if (!clientId || !clientSecret || !calendarId) {
  fail("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALENDAR_ID are required. Run with: op run --env-file=.env.op -- npm run setup:google");
}

const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    login_hint: LOGIN_HINT,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

function waitForCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", REDIRECT_URI);
      if (url.pathname !== "/callback") {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const ok = !error && code && url.searchParams.get("state") === state;
      res.writeHead(ok ? 200 : 400, { "Content-Type": "text/plain" });
      res.end(ok ? "Authorized. You can close this tab and return to the terminal." : `Authorization failed: ${error || "state mismatch"}`);
      server.close();
      if (ok) resolve(code!);
      else reject(new Error(error || "state mismatch"));
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1");
  });
}

async function exchange(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) fail(`Token exchange failed: ${body.error} ${body.error_description ?? ""}`);
  if (!body.refresh_token) fail("Google returned no refresh token. Remove the app at myaccount.google.com/permissions and run again.");
  return body;
}

async function verify(accessToken: string) {
  const now = new Date();
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + 7 * 86400_000).toISOString(),
      items: [{ id: calendarId }],
    }),
  });
  const body = (await response.json()) as { calendars?: Record<string, { busy?: unknown[]; errors?: Array<{ reason: string }> }> };
  const entry = body.calendars?.[calendarId!];
  if (!response.ok || !entry || entry.errors?.length) {
    fail(`Signed in, but this account cannot read the demo calendar (${entry?.errors?.map((e) => e.reason).join(", ") || response.status}). Sign in as the calendar owner.`);
  }
  console.log(`Calendar check passed: ${entry.busy?.length ?? 0} busy block(s) in the next 7 days.`);
}

function save(refreshToken: string) {
  execFileSync("op", ["item", "edit", OP_ITEM, "--vault", OP_VAULT, `refresh_token[password]=${refreshToken}`], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`Saved refresh_token to 1Password (${OP_VAULT} / ${OP_ITEM}).`);
}

async function main() {
  console.log(`Sign in as ${LOGIN_HINT}. Opening the browser...\nIf it does not open, visit:\n\n${authUrl}\n`);
  console.log(`If Google shows redirect_uri_mismatch, add ${REDIRECT_URI} to the OAuth client's authorized redirect URIs.\n`);
  const codePromise = waitForCode();
  spawn("open", [authUrl], { stdio: "ignore", detached: true }).on("error", () => {});
  const code = await codePromise.catch((error: Error) => fail(`Authorization failed: ${error.message}`));
  const tokens = await exchange(code);
  const granted = (tokens.scope || "").split(" ");
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) fail(`Missing scopes: ${missing.join(", ")}. Grant calendar access on the consent screen.`);
  await verify(tokens.access_token!);
  save(tokens.refresh_token!);
  if (tokens.refresh_token_expires_in) {
    const days = Math.round(tokens.refresh_token_expires_in / 86400);
    console.warn(
      `\nWARNING: this refresh token expires in about ${days} day(s). The OAuth consent screen is in Testing mode.\n` +
        "Set it to Internal (Google Auth Platform > Audience) and run this again for a token that does not expire.",
    );
  }
  console.log("\nDone. Restart with: op run --env-file=.env.op -- npm run dev");
}

main();
