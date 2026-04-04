export function StepLoading() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0f1117" }}
    >
      <div className="text-center">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
          style={{
            background: "linear-gradient(135deg, #6c63ff, #4ade80)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          <span className="text-3xl">🤖</span>
        </div>
        <p className="text-lg font-bold mb-2" style={{ color: "#e2e8f0" }}>
          Claude がタスクを整理しています...
        </p>
        <p className="text-sm" style={{ color: "#94a3b8" }}>
          10〜20秒ほどかかります
        </p>
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.8;transform:scale(1.05)} }`}</style>
      </div>
    </div>
  );
}
