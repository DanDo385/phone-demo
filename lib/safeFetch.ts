// Server-side fetch for a URL a visitor typed. http/https only, with DNS and redirect
// checks so a link cannot reach loopback, private, link-local, CGNAT, or cloud-metadata
// addresses. Every redirect hop is checked again. The connection uses the address we
// already approved, so a second DNS answer cannot swap in a blocked address.

import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import tls from "node:tls";
import { brand } from "./brand";

export const SAFE_FETCH_MAX_REDIRECTS = 5;
export const SAFE_FETCH_TIMEOUT_MS = 10_000;
export const SAFE_FETCH_MAX_BYTES = 3 * 1024 * 1024;

export const SAFE_FETCH_USER_AGENT = `${brand.company.name.replace(/\s+/g, "")}/1.0 (+https://${brand.domain}; link-check)`;

const METADATA_HOSTS = new Set(["metadata.google.internal", "metadata.goog"]);

const blocked4 = new BlockList();
blocked4.addSubnet("0.0.0.0", 8, "ipv4");
blocked4.addSubnet("10.0.0.0", 8, "ipv4");
blocked4.addSubnet("100.64.0.0", 10, "ipv4"); // CGNAT, also Alibaba metadata 100.100.100.200
blocked4.addSubnet("127.0.0.0", 8, "ipv4");
blocked4.addSubnet("169.254.0.0", 16, "ipv4"); // link-local, includes 169.254.169.254
blocked4.addSubnet("172.16.0.0", 12, "ipv4");
blocked4.addSubnet("192.168.0.0", 16, "ipv4");
blocked4.addSubnet("192.0.0.0", 24, "ipv4");
blocked4.addSubnet("198.18.0.0", 15, "ipv4");
blocked4.addSubnet("224.0.0.0", 4, "ipv4");
blocked4.addSubnet("240.0.0.0", 4, "ipv4");

const blocked6 = new BlockList();
blocked6.addAddress("::", "ipv6");
blocked6.addAddress("::1", "ipv6");
blocked6.addSubnet("fc00::", 7, "ipv6");
blocked6.addSubnet("fe80::", 10, "ipv6");

export class SafeFetchError extends Error {
  readonly code: "blocked" | "unsupported_url" | "too_many_redirects" | "body_too_large" | "timeout" | "dns";

  constructor(code: SafeFetchError["code"]) {
    super(code);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export function isBlockedAddress(ip: string): boolean {
  const unmapped = unwrapMapped(ip.trim().toLowerCase().split("%")[0]);
  if (!unmapped) return true;
  if (unmapped.family === 4) return blocked4.check(unmapped.address, "ipv4");
  return blocked6.check(unmapped.address, "ipv6");
}

function unwrapMapped(ip: string): { address: string; family: 4 | 6 } | null {
  const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return { address: dotted[1], family: 4 };
  const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return { address: `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`, family: 4 };
  }
  const family = isIP(ip);
  if (family === 4) return { address: ip, family: 4 };
  if (family === 6) return { address: ip, family: 6 };
  return null;
}

export type DnsAnswer = { address: string; family: 4 | 6 };

export type HopResult = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body?: Buffer;
};

export type SafeFetchDeps = {
  resolve: (hostname: string) => Promise<DnsAnswer[]>;
  request: (input: { url: URL; address: string; family: 4 | 6; timeoutMs: number; readBody: boolean }) => Promise<HopResult>;
};

let testDeps: SafeFetchDeps | null = null;

export function setSafeFetchDepsForTests(deps: SafeFetchDeps | null): void {
  testDeps = deps;
}

async function defaultResolve(hostname: string): Promise<DnsAnswer[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family === 6 ? 6 : 4 }));
}

function defaultRequest(input: { url: URL; address: string; family: 4 | 6; timeoutMs: number; readBody: boolean }): Promise<HopResult> {
  const lib = input.url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        host: input.address,
        port: input.url.port || (input.url.protocol === "https:" ? 443 : 80),
        servername: input.url.hostname,
        method: "GET",
        path: `${input.url.pathname}${input.url.search}`,
        headers: {
          Host: input.url.host,
          "User-Agent": SAFE_FETCH_USER_AGENT,
          Accept: "*/*",
        },
        timeout: input.timeoutMs,
        ...(input.url.protocol === "https:"
          ? { checkServerIdentity: (_host: string, cert: tls.PeerCertificate) => tls.checkServerIdentity(input.url.hostname, cert) }
          : {}),
      },
      (res) => {
        const status = res.statusCode || 0;
        const redirect = status >= 300 && status < 400;
        if (!input.readBody || redirect) {
          res.resume();
          resolve({ status, headers: res.headers });
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > SAFE_FETCH_MAX_BYTES) {
            res.destroy();
            reject(new SafeFetchError("body_too_large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new SafeFetchError("timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

export type SafeResponse = { url: string; status: number; headers: Record<string, string>; body: Buffer };

export type SafeFetchInit = { timeoutMs?: number; maxRedirects?: number; readBody?: boolean };

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new SafeFetchError("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function header(headers: HopResult["headers"], name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

/** WHATWG hostname keeps brackets on an IPv6 literal (`[::1]`). `isIP` rejects that form. */
function hostLiteral(hostname: string): string {
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return bare.split("%")[0];
}

function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("unsupported_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SafeFetchError("unsupported_url");
  if (url.username || url.password) throw new SafeFetchError("unsupported_url");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || METADATA_HOSTS.has(hostLiteral(host))) throw new SafeFetchError("blocked");
  return url;
}

async function approvedAddress(url: URL, resolve: SafeFetchDeps["resolve"]): Promise<DnsAnswer> {
  const literal = hostLiteral(url.hostname);
  const ipFamily = isIP(literal);
  if (ipFamily) {
    if (isBlockedAddress(literal)) throw new SafeFetchError("blocked");
    return { address: literal, family: ipFamily === 6 ? 6 : 4 };
  }
  let answers: DnsAnswer[];
  try {
    answers = await resolve(url.hostname);
  } catch (error) {
    if (error instanceof SafeFetchError) throw error;
    throw new SafeFetchError("dns");
  }
  if (answers.length === 0) throw new SafeFetchError("dns");
  if (answers.some((answer) => isBlockedAddress(answer.address))) throw new SafeFetchError("blocked");
  return answers[0];
}

export async function safeFetch(input: string, init: SafeFetchInit = {}): Promise<SafeResponse> {
  const timeoutMs = init.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxRedirects = init.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
  const readBody = init.readBody ?? true;
  const deps = testDeps ?? { resolve: defaultResolve, request: defaultRequest };
  const deadline = Date.now() + timeoutMs;
  let current = parseHttpUrl(input);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("timeout");
    const address = await approvedAddress(current, deps.resolve);
    const hopResult = await withTimeout(
      deps.request({ url: current, address: address.address, family: address.family, timeoutMs: remaining, readBody }),
      remaining,
    );
    const location = header(hopResult.headers, "location");
    const redirect = hopResult.status >= 300 && hopResult.status < 400 && location;
    if (!redirect) {
      const body = hopResult.body ?? Buffer.alloc(0);
      if (body.length > SAFE_FETCH_MAX_BYTES) throw new SafeFetchError("body_too_large");
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(hopResult.headers)) {
        if (typeof value === "string") headers[key] = value;
        else if (Array.isArray(value)) headers[key] = value.join(", ");
      }
      return { url: current.toString(), status: hopResult.status, headers, body };
    }
    if (hop === maxRedirects) throw new SafeFetchError("too_many_redirects");
    current = parseHttpUrl(new URL(location, current).toString());
  }
  throw new SafeFetchError("too_many_redirects");
}
