"use client";

import Link from "next/link";
import { track, type TrackProps } from "@/lib/track";

export function TrackedLink({ href, event, props, className, children }: { href: string; event: string; props?: TrackProps; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => track(event, { href, ...props })}>
      {children}
    </Link>
  );
}
