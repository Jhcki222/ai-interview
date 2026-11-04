export default function Loading() {
  return (
    <div className="page-loading" role="status" aria-label="화면 불러오는 중">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton skeleton-panel" />
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
