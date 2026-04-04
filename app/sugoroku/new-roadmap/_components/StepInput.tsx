import type { Member } from "@/lib/supabase/types";

const DURATION_OPTIONS = [
  { value: "1ヶ月", label: "1ヶ月" },
  { value: "3ヶ月", label: "3ヶ月" },
  { value: "6ヶ月", label: "6ヶ月" },
  { value: "カスタム", label: "カスタム" },
];

interface StepInputProps {
  members: Member[];
  selectedMemberId: string;
  duration: string;
  goal: string;
  inputText: string;
  error: string | null;
  onMemberChange: (id: string) => void;
  onDurationChange: (d: string) => void;
  onGoalChange: (g: string) => void;
  onTextChange: (t: string) => void;
  onGenerate: () => void;
}

export function StepInput({
  members,
  selectedMemberId,
  duration,
  goal,
  inputText,
  error,
  onMemberChange,
  onDurationChange,
  onGoalChange,
  onTextChange,
  onGenerate,
}: StepInputProps) {
  const canGenerate = inputText.length >= 50 && !!selectedMemberId && goal.trim().length > 0;

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <nav
        className="px-6 py-3 flex items-center gap-4"
        style={{ borderBottom: "1px solid #2e3347", background: "#1a1d27" }}
      >
        <a href="/sugoroku/dashboard" style={{ color: "#94a3b8", fontSize: "14px" }}>
          ← ダッシュボード
        </a>
        <span style={{ color: "#2e3347" }}>/</span>
        <span style={{ color: "#e2e8f0", fontSize: "14px" }}>ロードマップ生成</span>
      </nav>

      <div
        className="max-w-5xl mx-auto px-4 py-8 grid gap-6"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        {/* 左カラム：入力 */}
        <div>
          <h1 className="text-xl font-bold mb-6" style={{ color: "#e2e8f0" }}>
            ✨ ロードマップを生成する
          </h1>

          <div className="mb-5">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#94a3b8" }}
            >
              対象メンバー
            </label>
            <select
              value={selectedMemberId}
              onChange={(e) => onMemberChange(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: "#1a1d27",
                border: "1px solid #2e3347",
                color: "#e2e8f0",
              }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#94a3b8" }}
            >
              期間の目安
            </label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onDurationChange(opt.value)}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background:
                      duration === opt.value
                        ? "rgba(108,99,255,0.2)"
                        : "#1a1d27",
                    border: `1px solid ${
                      duration === opt.value ? "#6c63ff" : "#2e3347"
                    }`,
                    color: duration === opt.value ? "#e2e8f0" : "#94a3b8",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-5">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#94a3b8" }}
            >
              このロードマップで達成したいこと
              <span className="ml-1 text-xs" style={{ color: "#f87171" }}>*必須</span>
            </label>
            <textarea
              value={goal}
              onChange={(e) => onGoalChange(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: "#1a1d27",
                border: `1px solid ${goal.trim() ? "#6c63ff" : "#2e3347"}`,
                color: "#e2e8f0",
                lineHeight: "1.6",
              }}
              placeholder="例）3ヶ月以内に一人で架電〜クロージングまで完結できる営業担当者に育成する"
            />
          </div>

          <div className="mb-5">
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "#94a3b8" }}
            >
              ロードマップを作成
            </label>
            <textarea
              value={inputText}
              onChange={(e) => onTextChange(e.target.value)}
              rows={14}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: "#1a1d27",
                border: "1px solid #2e3347",
                color: "#e2e8f0",
                lineHeight: "1.6",
              }}
              placeholder={`例）\n・営業フロー：初回架電 → ヒアリング → 提案 → クロージング\n・入社後3ヶ月で一人立ちを目指す\n・まず商品知識のインプット、次にロールプレイ、最後に実践...\n\n育成方針・研修カリキュラム・引継ぎ資料など\n長文でも大丈夫です`}
            />
            <p
              className="text-xs mt-1"
              style={{ color: inputText.length < 50 ? "#f87171" : "#4a5568" }}
            >
              {inputText.length}文字（最低50文字）
            </p>
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{
                background: "#1f0f0f",
                border: "1px solid #f87171",
                color: "#f87171",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: canGenerate
                ? "linear-gradient(135deg, #6c63ff, #5b52ee)"
                : "#232636",
              color: canGenerate ? "#fff" : "#4a5568",
              cursor: canGenerate ? "pointer" : "not-allowed",
            }}
          >
            ✨ ロードマップを生成する
          </button>
        </div>

        {/* 右カラム：説明 */}
        <div
          className="flex flex-col justify-center"
          style={{ paddingTop: "60px" }}
        >
          <div
            className="rounded-2xl p-6"
            style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
          >
            <h3
              className="font-bold text-sm mb-4"
              style={{ color: "#e2e8f0" }}
            >
              どう使うの？
            </h3>
            <div className="space-y-4">
              {[
                {
                  icon: "📋",
                  title: "資料を貼り付ける",
                  desc: "育成方針・研修カリキュラム・引継ぎ資料など、長文テキストをそのまま貼るだけでOK",
                },
                {
                  icon: "🤖",
                  title: "Claude が分析",
                  desc: "AIが内容を読み取り、学習順序を考慮した15〜25個のタスクを自動生成",
                },
                {
                  icon: "✏️",
                  title: "プレビューで編集",
                  desc: "生成されたタスクを確認・編集してから反映。不要なタスクの削除や追加も可能",
                },
                {
                  icon: "🎲",
                  title: "すごろくに反映",
                  desc: "「反映する」を押すとメンバーのダッシュボードにボードが作成される",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-3">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: "#e2e8f0" }}
                    >
                      {item.title}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "#94a3b8" }}
                    >
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
