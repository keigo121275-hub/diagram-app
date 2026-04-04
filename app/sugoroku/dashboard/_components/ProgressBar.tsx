export function ProgressBar({
  done,
  total,
}: {
  done: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: "#94a3b8" }}>
          進捗
        </span>
        <span className="text-sm font-bold" style={{ color: "#e2e8f0" }}>
          {done} / {total} タスク完了 ({pct}%)
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: "10px", background: "#232636" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(to right, #6c63ff, #4ade80)",
          }}
        />
      </div>
    </div>
  );
}
