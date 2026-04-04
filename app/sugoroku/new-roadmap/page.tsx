"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/supabase/types";

type GeneratedTask = {
  title: string;
  level: "large" | "medium" | "small";
  order: number;
};

type GenerateResult = {
  roadmap_title: string;
  tasks: GeneratedTask[];
};

const DURATION_OPTIONS = [
  { value: "1ヶ月", label: "1ヶ月" },
  { value: "3ヶ月", label: "3ヶ月" },
  { value: "6ヶ月", label: "6ヶ月" },
  { value: "カスタム", label: "カスタム" },
];

const LEVEL_LABELS = { large: "大", medium: "中", small: "小" };
const LEVEL_COLORS = {
  large: { bg: "rgba(108,99,255,0.15)", text: "#6c63ff", border: "rgba(108,99,255,0.3)" },
  medium: { bg: "rgba(96,165,250,0.15)", text: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  small: { bg: "rgba(148,163,184,0.15)", text: "#94a3b8", border: "rgba(148,163,184,0.3)" },
};

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  todo: { bg: "#1e2130", border: "#2e3347" },
  done: { bg: "#052e16", border: "#166534" },
};

export default function NewRoadmapPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [duration, setDuration] = useState("3ヶ月");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("members").select("*").then(({ data }) => {
      setMembers((data as Member[]) ?? []);
      if (data && data.length > 0) setSelectedMemberId(data[0].id);
    });
  }, []);

  const handleGenerate = async () => {
    if (inputText.length < 50) {
      setError("テキストは50文字以上入力してください");
      return;
    }
    setError(null);
    setStep(2);

    const res = await fetch("/api/sugoroku/generate-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputText, duration }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "生成に失敗しました");
      setStep(1);
      return;
    }

    const data: GenerateResult = await res.json();
    setResult(data);
    setTasks(data.tasks.map((t, i) => ({ ...t, order: i + 1 })));
    setStep(3);
  };

  const handleSave = async () => {
    if (!selectedMemberId || !result) return;
    setSaving(true);

    const supabase = createClient();

    // ロードマップ作成
    const { data: roadmap, error: rmErr } = await supabase
      .from("roadmaps")
      .insert({ member_id: selectedMemberId, title: result.roadmap_title })
      .select()
      .single();

    if (rmErr || !roadmap) {
      setError("ロードマップの保存に失敗しました: " + rmErr?.message);
      setSaving(false);
      return;
    }

    // タスク一括 INSERT
    const taskInserts = tasks.map((t, i) => ({
      roadmap_id: roadmap.id,
      title: t.title,
      level: t.level,
      order: i + 1,
      status: "todo" as const,
    }));

    const { error: tasksErr } = await supabase.from("tasks").insert(taskInserts);

    if (tasksErr) {
      setError("タスクの保存に失敗しました: " + tasksErr.message);
      setSaving(false);
      return;
    }

    // 生成ログ保存
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("roadmap_generations").insert({
      roadmap_id: roadmap.id,
      created_by: user?.id,
      input_text: inputText,
      output_json: result as unknown as import("@/lib/supabase/types").Json,
    });

    setStep(4);
    setSaving(false);
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // ────────────── Step 1: 入力 ──────────────
  if (step === 1) {
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

        <div className="max-w-5xl mx-auto px-4 py-8 grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {/* 左カラム：入力 */}
          <div>
            <h1 className="text-xl font-bold mb-6" style={{ color: "#e2e8f0" }}>
              ✨ ロードマップを生成する
            </h1>

            {/* 対象メンバー */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>
                対象メンバー
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
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

            {/* 期間 */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>
                期間の目安
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background: duration === opt.value ? "rgba(108,99,255,0.2)" : "#1a1d27",
                      border: `1px solid ${duration === opt.value ? "#6c63ff" : "#2e3347"}`,
                      color: duration === opt.value ? "#e2e8f0" : "#94a3b8",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* テキストエリア */}
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>
                育成資料・引継ぎ内容を貼り付け
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={14}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: "#1a1d27",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                  lineHeight: "1.6",
                }}
                placeholder={`例）
・営業フロー：初回架電 → ヒアリング → 提案 → クロージング
・入社後3ヶ月で一人立ちを目指す
・まず商品知識のインプット、次にロールプレイ、最後に実践...

育成方針・研修カリキュラム・引継ぎ資料など
長文でも大丈夫です`}
              />
              <p className="text-xs mt-1" style={{ color: inputText.length < 50 ? "#f87171" : "#4a5568" }}>
                {inputText.length}文字（最低50文字）
              </p>
            </div>

            {error && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{ background: "#1f0f0f", border: "1px solid #f87171", color: "#f87171" }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={inputText.length < 50 || !selectedMemberId}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background:
                  inputText.length >= 50 && selectedMemberId
                    ? "linear-gradient(135deg, #6c63ff, #5b52ee)"
                    : "#232636",
                color: inputText.length >= 50 && selectedMemberId ? "#fff" : "#4a5568",
                cursor: inputText.length >= 50 && selectedMemberId ? "pointer" : "not-allowed",
              }}
            >
              ✨ ロードマップを生成する
            </button>
          </div>

          {/* 右カラム：説明 */}
          <div className="flex flex-col justify-center" style={{ paddingTop: "60px" }}>
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
            >
              <h3 className="font-bold text-sm mb-4" style={{ color: "#e2e8f0" }}>
                どう使うの？
              </h3>
              <div className="space-y-4">
                {[
                  { icon: "📋", title: "資料を貼り付ける", desc: "育成方針・研修カリキュラム・引継ぎ資料など、長文テキストをそのまま貼るだけでOK" },
                  { icon: "🤖", title: "Claude が分析", desc: "AIが内容を読み取り、学習順序を考慮した15〜25個のタスクを自動生成" },
                  { icon: "✏️", title: "プレビューで編集", desc: "生成されたタスクを確認・編集してから反映。不要なタスクの削除や追加も可能" },
                  { icon: "🎲", title: "すごろくに反映", desc: "「反映する」を押すとメンバーのダッシュボードにボードが作成される" },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="text-xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e2e8f0" }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{item.desc}</p>
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

  // ────────────── Step 2: 生成中 ──────────────
  if (step === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f1117" }}>
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

  // ────────────── Step 3: プレビュー・編集 ──────────────
  if (step === 3 && result) {
    const COLS = 5;
    const rows: GeneratedTask[][] = [];
    for (let i = 0; i < tasks.length; i += COLS) {
      rows.push(tasks.slice(i, i + COLS));
    }

    return (
      <div className="min-h-screen" style={{ background: "#0f1117" }}>
        <nav
          className="px-6 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid #2e3347", background: "#1a1d27" }}
        >
          <div className="flex items-center gap-4">
            <button onClick={() => setStep(1)} style={{ color: "#94a3b8", fontSize: "14px" }}>
              ← 入力に戻る
            </button>
            <span style={{ color: "#2e3347" }}>/</span>
            <span style={{ color: "#e2e8f0", fontSize: "14px" }}>プレビュー・編集</span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || tasks.length === 0}
            className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: saving ? "#232636" : "linear-gradient(135deg, #4ade80, #22c55e)",
              color: saving ? "#4a5568" : "#fff",
            }}
          >
            {saving ? "保存中..." : "✅ このロードマップを反映する"}
          </button>
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* ヘッダー */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
                {result.roadmap_title}
              </h2>
              <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
                対象: {selectedMember?.name} ／ {tasks.length}タスク ／ {duration}
              </p>
            </div>
            <button
              onClick={() => {
                setTasks([
                  ...tasks,
                  { title: "新しいタスク", level: "medium", order: tasks.length + 1 },
                ]);
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#94a3b8" }}
            >
              + タスクを追加
            </button>
          </div>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#1f0f0f", border: "1px solid #f87171", color: "#f87171" }}
            >
              {error}
            </div>
          )}

          {/* すごろくグリッド */}
          <div
            className="rounded-2xl p-6 mb-6"
            style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
          >
            <div className="space-y-2">
              {rows.map((row, rowIdx) => {
                const isEvenRow = rowIdx % 2 === 0;
                const displayRow = isEvenRow ? row : [...row].reverse();
                return (
                  <div key={rowIdx}>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                      {displayRow.map((task) => {
                        const originalIdx = tasks.findIndex((t) => t === task);
                        const lc = LEVEL_COLORS[task.level];
                        return (
                          <div
                            key={originalIdx}
                            className="relative rounded-xl p-3 cursor-pointer group"
                            style={{
                              minHeight: "92px",
                              background: STATUS_COLORS.todo.bg,
                              border: `1px solid ${STATUS_COLORS.todo.border}`,
                            }}
                            onClick={() => setEditingIdx(editingIdx === originalIdx ? null : originalIdx)}
                          >
                            <div
                              className="absolute top-2 left-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ background: "#0f1117", color: "#94a3b8" }}
                            >
                              {originalIdx + 1}
                            </div>
                            <button
                              className="absolute top-1 right-1 w-5 h-5 rounded flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ background: "#f87171", color: "#fff" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTasks(tasks.filter((_, i) => i !== originalIdx));
                                setEditingIdx(null);
                              }}
                            >
                              ✕
                            </button>
                            <div className="mt-5">
                              <p className="text-xs font-medium leading-snug" style={{ color: "#e2e8f0" }}>
                                {task.title}
                              </p>
                            </div>
                            <div className="mt-2">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}
                              >
                                {LEVEL_LABELS[task.level]}タスク
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {rowIdx < rows.length - 1 && (
                      <div className="flex justify-end py-1 pr-2">
                        <span style={{ color: "#2e3347", fontSize: "20px" }}>↓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 編集パネル */}
          {editingIdx !== null && tasks[editingIdx] && (
            <div
              className="rounded-2xl p-5 mb-6"
              style={{ background: "#1a1d27", border: "1px solid #6c63ff" }}
            >
              <p className="text-sm font-medium mb-3" style={{ color: "#6c63ff" }}>
                タスク {editingIdx + 1} を編集
              </p>
              <div className="flex gap-3">
                <input
                  value={tasks[editingIdx].title}
                  onChange={(e) => {
                    const updated = [...tasks];
                    updated[editingIdx] = { ...updated[editingIdx], title: e.target.value };
                    setTasks(updated);
                  }}
                  className="flex-1 px-4 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#232636", border: "1px solid #2e3347", color: "#e2e8f0" }}
                />
                <select
                  value={tasks[editingIdx].level}
                  onChange={(e) => {
                    const updated = [...tasks];
                    updated[editingIdx] = {
                      ...updated[editingIdx],
                      level: e.target.value as "large" | "medium" | "small",
                    };
                    setTasks(updated);
                  }}
                  className="px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "#232636", border: "1px solid #2e3347", color: "#e2e8f0" }}
                >
                  <option value="large">大タスク</option>
                  <option value="medium">中タスク</option>
                  <option value="small">小タスク</option>
                </select>
                <button
                  onClick={() => setEditingIdx(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: "#232636", color: "#94a3b8" }}
                >
                  完了
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ────────────── Step 4: 完了 ──────────────
  if (step === 4) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0f1117" }}>
        <div className="text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#e2e8f0" }}>
            ロードマップを反映しました！
          </h2>
          <p className="text-sm mb-8" style={{ color: "#94a3b8" }}>
            {selectedMember?.name} のダッシュボードにボードが作成されました
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/sugoroku/dashboard")}
              className="px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #6c63ff, #5b52ee)", color: "#fff" }}
            >
              ダッシュボードへ
            </button>
            <button
              onClick={() => {
                setStep(1);
                setInputText("");
                setResult(null);
                setTasks([]);
                setError(null);
              }}
              className="px-6 py-3 rounded-xl text-sm font-bold"
              style={{ background: "#1a1d27", border: "1px solid #2e3347", color: "#94a3b8" }}
            >
              もう一つ生成する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
