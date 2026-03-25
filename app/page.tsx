/**
 * トップページ（/）
 *
 * 役割：図解の種類を選んでチャット画面に進む、最初の画面。
 *
 * 流れ：
 *   ① ユーザーが図の種類を選ぶ（マインドマップ・STEP・報告）
 *   ② 報告型のときだけ「良い報告か改善報告か」を追加で選ぶ
 *   ③「始める」ボタンを押すと /chat?type=xxx&tone=xxx に移動する
 *
 * なぜURLパラメータで渡すか：
 *   チャット画面は別ページなので、選択内容をURLに乗せて引き継ぐ。
 *   例） /chat?type=report&tone=good
 */

"use client"; // このページはブラウザ側で動く（ユーザー操作があるため）

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

type DiagramType = "mindmap" | "step-flow" | "report";
type ReportTone = "good" | "normal";

// 選択肢の定義（表示テキストとアイコンをまとめて管理）
const DIAGRAM_OPTIONS = [
  {
    id: "mindmap" as DiagramType,
    icon: "🧠",
    title: "マインドマップ型",
    desc: "アイデアをバーッと広げて整理したい時",
  },
  {
    id: "step-flow" as DiagramType,
    icon: "📋",
    title: "STEP・フロー型",
    desc: "1通目→2通目、章立て、順番のある構成を整理したい時",
  },
  {
    id: "report" as DiagramType,
    icon: "📊",
    title: "報告型",
    desc: "結果・結論を相手に伝えたい時",
  },
];

// ─────────────────────────────────────────────
// コンポーネント
// ─────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // 選択中の図の種類（未選択は null）
  const [selectedType, setSelectedType] = useState<DiagramType | null>(null);

  // 報告型のとき追加で選ぶトーン（未選択は null）
  const [reportTone, setReportTone] = useState<ReportTone | null>(null);

  // 「始める」ボタンが押せる条件：
  //   - 図の種類が選ばれている
  //   - 報告型の場合はさらにトーンも選ばれている
  const canStart = selectedType !== null && (selectedType !== "report" || reportTone !== null);

  // 「始める」を押したらチャット画面に移動
  const handleStart = () => {
    if (!canStart) return;
    const params = new URLSearchParams({ type: selectedType! });
    if (reportTone) params.set("tone", reportTone);
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">

        {/* ヘッダー */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest text-blue-500 mb-3">DIAGRAM MAKER</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">会話を図解する</h1>
          <p className="text-sm text-gray-500">どの図で整理しますか？</p>
        </div>

        {/* 図の種類を選ぶボタン */}
        <div className="flex flex-col gap-3 mb-8">
          {DIAGRAM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setSelectedType(opt.id);
                setReportTone(null); // 種類を変えたらトーンをリセット
              }}
              className={`w-full text-left px-6 py-5 rounded-2xl border-2 transition-all duration-150 ${
                selectedType === opt.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-2xl">{opt.icon}</span>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{opt.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </div>
                {/* 選択済みのチェックマーク */}
                {selectedType === opt.id && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* 報告型のときだけ表示：良い報告か改善報告かを選ぶ */}
        {selectedType === "report" && (
          <div className="mb-8 px-6 py-5 bg-orange-50 border border-orange-200 rounded-2xl">
            <p className="text-sm font-bold text-orange-800 mb-3">どちらの報告ですか？</p>
            <div className="flex gap-3">
              {[
                { id: "good" as ReportTone, label: "✅ 良い報告", activeClass: "border-orange-400 bg-orange-400 text-white", inactiveClass: "border-orange-200 text-orange-700 bg-white hover:border-orange-300" },
                { id: "normal" as ReportTone, label: "📋 普通/改善報告", activeClass: "border-blue-400 bg-blue-400 text-white", inactiveClass: "border-blue-200 text-blue-700 bg-white hover:border-blue-300" },
              ].map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setReportTone(tone.id)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    reportTone === tone.id ? tone.activeClass : tone.inactiveClass
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 始めるボタン */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
            canStart
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          始める →
        </button>

      </div>
    </main>
  );
}
