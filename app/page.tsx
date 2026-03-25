// 【このファイルの役割】
// アプリを開いたときに最初に表示される画面
// 「マインドマップ型」「STEP・フロー型」「報告型」を選ぶだけのシンプルな画面

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DiagramType = "mindmap" | "step-flow" | "report";
type ReportTone = "good" | "normal";

export default function Home() {
  const router = useRouter();
  const [selected, setSelected] = useState<DiagramType | null>(null);
  const [reportTone, setReportTone] = useState<ReportTone | null>(null);

  // 「始める」ボタンを押したらチャット画面に移動する
  // URLにパラメータをつけて選択内容を渡す
  const handleStart = () => {
    if (!selected) return;
    if (selected === "report" && !reportTone) return;

    const params = new URLSearchParams({ type: selected });
    if (reportTone) params.set("tone", reportTone);
    router.push(`/chat?${params.toString()}`);
  };

  const options = [
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

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">

        {/* タイトル */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest text-blue-500 mb-3">DIAGRAM MAKER</p>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">会話を図解する</h1>
          <p className="text-sm text-gray-500">
            どの図で整理しますか？
          </p>
        </div>

        {/* 選択肢 */}
        <div className="flex flex-col gap-3 mb-8">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setSelected(opt.id);
                setReportTone(null);
              }}
              className={`w-full text-left px-6 py-5 rounded-2xl border-2 transition-all duration-150 ${
                selected === opt.id
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
                {selected === opt.id && (
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

        {/* 報告型が選ばれたときだけ「良い報告か？」を表示 */}
        {selected === "report" && (
          <div className="mb-8 px-6 py-5 bg-orange-50 border border-orange-200 rounded-2xl">
            <p className="text-sm font-bold text-orange-800 mb-3">どちらの報告ですか？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setReportTone("good")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                  reportTone === "good"
                    ? "border-orange-400 bg-orange-400 text-white"
                    : "border-orange-200 text-orange-700 bg-white hover:border-orange-300"
                }`}
              >
                ✅ 良い報告
              </button>
              <button
                onClick={() => setReportTone("normal")}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                  reportTone === "normal"
                    ? "border-blue-400 bg-blue-400 text-white"
                    : "border-blue-200 text-blue-700 bg-white hover:border-blue-300"
                }`}
              >
                📋 普通/改善報告
              </button>
            </div>
          </div>
        )}

        {/* 始めるボタン */}
        <button
          onClick={handleStart}
          disabled={!selected || (selected === "report" && !reportTone)}
          className={`w-full py-4 rounded-2xl font-bold text-sm transition-all ${
            selected && (selected !== "report" || reportTone)
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
