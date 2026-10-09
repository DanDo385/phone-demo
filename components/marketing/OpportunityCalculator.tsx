"use client";

import { useMemo, useState } from "react";

const illustrative = { calls: 200, missed: 50, qualified: 40, recovery: 50, close: 25, job: 10000, margin: 0 };

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function OpportunityCalculator() {
  const [calls, setCalls] = useState(illustrative.calls);
  const [missed, setMissed] = useState(illustrative.missed);
  const [qualified, setQualified] = useState(illustrative.qualified);
  const [recovery, setRecovery] = useState(illustrative.recovery);
  const [close, setClose] = useState(illustrative.close);
  const [job, setJob] = useState(illustrative.job);
  const [margin, setMargin] = useState(illustrative.margin);
  const [showMargin, setShowMargin] = useState(false);

  const result = useMemo(() => {
    const recovered = calls * (missed / 100) * (qualified / 100) * (recovery / 100);
    const revenue = recovered * (close / 100) * job;
    const contribution = revenue * (margin / 100);
    return { recovered, revenue, contribution };
  }, [calls, missed, qualified, recovery, close, job, margin]);

  return (
    <form className="m-card m-calc" onSubmit={(event) => event.preventDefault()}>
      <p className="m-fine">Scenario, not a forecast. Every number below is an assumption until you replace it with your own.</p>
      <div className="m-calc-grid">
        <Field id="calc-calls" label="Monthly calls" value={calls} min={0} max={100000} step={1} onChange={setCalls} />
        <Field id="calc-missed" label="Missed-call rate (%)" value={missed} min={0} max={100} step={1} onChange={setMissed} />
        <Field id="calc-qualified" label="Qualified share of missed calls (%)" value={qualified} min={0} max={100} step={1} onChange={setQualified} />
        <Field id="calc-recovery" label="Incremental recovery rate (%)" value={recovery} min={0} max={100} step={1} onChange={setRecovery} />
        <Field id="calc-close" label="Close rate on recovered qualified leads (%)" value={close} min={0} max={100} step={1} onChange={setClose} />
        <Field id="calc-job" label="Average job revenue ($)" value={job} min={0} max={10000000} step={100} onChange={setJob} />
      </div>
      <label className="m-check">
        <input type="checkbox" checked={showMargin} onChange={(event) => setShowMargin(event.target.checked)} />
        <span>Also estimate contribution from a margin I enter</span>
      </label>
      {showMargin && <Field id="calc-margin" label="Margin (%)" value={margin} min={0} max={100} step={1} onChange={setMargin} />}
      <div className="m-calc-out" role="status">
        <p><strong>{result.recovered.toFixed(1)}</strong> recovered qualified inquiries per month, from the inputs above.</p>
        <p><strong>{money(result.revenue)}</strong> potential additional monthly revenue. This is a scenario.</p>
        {showMargin && <p><strong>{money(result.contribution)}</strong> contribution, using the margin you entered.</p>}
      </div>
      <p className="m-fine">Illustrative arithmetic, not a published statistic: 20 otherwise-lost qualified inquiries recovered per month × 25% closing rate × $10,000 average job revenue = $50,000 potential additional monthly revenue. The defaults above are one way to reach about 20 recovered inquiries. They are assumptions.</p>
      <button type="button" className="m-btn m-btn-secondary" onClick={() => { setCalls(illustrative.calls); setMissed(illustrative.missed); setQualified(illustrative.qualified); setRecovery(illustrative.recovery); setClose(illustrative.close); setJob(illustrative.job); setMargin(0); }}>Reset the illustrative assumptions</button>
    </form>
  );
}

function Field({ id, label, value, min, max, step, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <div className="m-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
