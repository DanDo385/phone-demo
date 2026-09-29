import { draftStamp } from "@/content/marketing/legal";

export function LegalPage({ page }: { page: { headline: string; sections: ReadonlyArray<{ heading: string; body: readonly string[] }> } }) {
  return (
    <div className="m-wrap m-page m-narrow">
      <p className="m-draft" role="note">{draftStamp}</p>
      <h1>{page.headline}</h1>
      {page.sections.map((s) => (
        <section key={s.heading} className="m-block">
          <h2>{s.heading}</h2>
          {s.body.map((p) => <p key={p}>{p}</p>)}
        </section>
      ))}
    </div>
  );
}
