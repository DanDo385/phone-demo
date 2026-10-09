"use client";

import { useState } from "react";
import { timelineStages } from "@/content/marketing/timeline";

export function SquirePreview() {
  const [open, setOpen] = useState(0);
  const stage = timelineStages[open];
  return (
    <div className="m-timeline">
      <ol className="m-timeline-nav">
        {timelineStages.map((item, index) => (
          <li key={item.n}>
            <button type="button" className={index === open ? "on" : ""} aria-current={index === open} onClick={() => setOpen(index)}>
              <span>{item.n}</span> {item.title}
            </button>
          </li>
        ))}
      </ol>
      <article className="m-card" aria-live="polite">
        <h3>{stage.title}</h3>
        <dl className="m-stage">
          <div><dt>Customer</dt><dd>{stage.customer}</dd></div>
          <div><dt>Business record</dt><dd>{stage.business}</dd></div>
          <div><dt>Tool</dt><dd><code>{stage.tool}</code></dd></div>
          <div><dt>Next</dt><dd>{stage.next}</dd></div>
        </dl>
      </article>
    </div>
  );
}
