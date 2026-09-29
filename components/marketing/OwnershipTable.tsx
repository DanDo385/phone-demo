import { ownershipColumns, ownershipRows } from "@/content/marketing/ownership";

export function OwnershipTable() {
  return (
    <div className="m-table-wrap">
      <table className="m-table">
        <caption className="m-sr">Who owns each asset, how we get access, and how you revoke it</caption>
        <thead>
          <tr>{ownershipColumns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {ownershipRows.map(([asset, ...rest]) => (
            <tr key={asset}>
              <th scope="row">{asset}</th>
              {rest.map((cell, i) => <td key={i} data-label={ownershipColumns[i + 1]}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
