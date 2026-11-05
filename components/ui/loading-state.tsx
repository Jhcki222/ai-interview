export function LoadingState({
  label = "화면을 준비하고 있어요",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={`loading-state${compact ? " loading-state--compact" : ""}`} role="status">
      <div className="loading-orbit" aria-hidden="true">
        <i />
        <i />
        <i />
        <span />
      </div>
      <div>
        <p>{label}</p>
        {!compact && <small>잠시만 기다려 주세요.</small>}
      </div>
    </div>
  );
}
