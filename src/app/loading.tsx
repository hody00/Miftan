export default function Loading() {
  return (
    <div className="content page-content" role="status">
      <div className="skeleton title-skeleton" />
      <p>פותחים דלת לאפשרויות…</p>
      <div className="listing-grid">
        {[1, 2, 3].map((n) => (
          <div key={n} className="skeleton card-skeleton" />
        ))}
      </div>
    </div>
  );
}
