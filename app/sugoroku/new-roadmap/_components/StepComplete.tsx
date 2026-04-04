interface StepCompleteProps {
  memberName: string | undefined;
  onGoToDashboard: () => void;
  onGenerateAnother: () => void;
}

export function StepComplete({
  memberName,
  onGoToDashboard,
  onGenerateAnother,
}: StepCompleteProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0f1117" }}
    >
      <div className="text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "#e2e8f0" }}>
          ロードマップを反映しました！
        </h2>
        <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>
          {memberName} のダッシュボードにボードが作成されました
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onGoToDashboard}
            className="px-6 py-3 rounded-xl text-sm font-bold"
            style={{
              background: "linear-gradient(135deg, #6c63ff, #5b52ee)",
              color: "#fff",
            }}
          >
            ダッシュボードへ
          </button>
          <button
            onClick={onGenerateAnother}
            className="px-6 py-3 rounded-xl text-sm font-bold"
            style={{
              background: "#1a1d27",
              border: "1px solid #2e3347",
              color: "#94a3b8",
            }}
          >
            もう一つ生成する
          </button>
        </div>
      </div>
    </div>
  );
}
