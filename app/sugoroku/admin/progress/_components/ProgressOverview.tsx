"use client";

import type { MemberProgress } from "../page";

interface ProgressOverviewProps {
  progressList: MemberProgress[];
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  const color =
    pct === 100 ? "#4ade80" : pct >= 50 ? "#6c63ff" : pct > 0 ? "#60a5fa" : "#2e3347";

  return (
    <svg width={56} height={56} className="shrink-0">
      <circle cx={28} cy={28} r={r} fill="none" stroke="#2e3347" strokeWidth={4} />
      <circle
        cx={28}
        cy={28}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dasharray 0.4s ease" }}
      />
      <text
        x={28}
        y={32}
        textAnchor="middle"
        fontSize={10}
        fontWeight="bold"
        fill={color}
      >
        {pct}%
      </text>
    </svg>
  );
}

export default function ProgressOverview({ progressList }: ProgressOverviewProps) {
  if (progressList.length === 0) {
    return (
      <div
        className="rounded-2xl p-16 text-center"
        style={{ background: "#1a1d27", border: "1px dashed #2e3347" }}
      >
        <div className="text-4xl mb-4">👥</div>
        <p style={{ color: "#94a3b8" }}>メンバーがいません</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
      {progressList.map((p) => (
        <a
          key={p.memberId}
          href="/sugoroku/dashboard"
          className="rounded-2xl p-5 block transition-all"
          style={{
            background: "#1a1d27",
            border: "1px solid #2e3347",
            textDecoration: "none",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "#6c63ff44";
            (e.currentTarget as HTMLAnchorElement).style.background = "#1e2133";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.borderColor = "#2e3347";
            (e.currentTarget as HTMLAnchorElement).style.background = "#1a1d27";
          }}
        >
          {/* 上段: アバター + 名前 + 進捗リング */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.memberName}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                  style={{ border: "2px solid #2e3347" }}
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "linear-gradient(135deg, #6c63ff, #4ade80)", color: "#fff" }}
                >
                  {p.memberName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: "#e2e8f0" }}>
                  {p.memberName}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: "#64748b" }}>
                  {p.roadmapTitle}
                </p>
              </div>
            </div>
            <ProgressRing pct={p.progressPct} />
          </div>

          {/* 進捗バー */}
          <div className="mt-4 mb-3">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "#232636" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${p.progressPct}%`,
                  background:
                    p.progressPct === 100
                      ? "#4ade80"
                      : p.progressPct >= 50
                      ? "linear-gradient(90deg, #6c63ff, #a5b4fc)"
                      : "#60a5fa",
                }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: "#64748b" }}>
              {p.doneTasks} / {p.totalTasks} マス完了
            </p>
          </div>

          {/* 現在のタスク */}
          {p.currentTaskTitle && (
            <div
              className="rounded-lg px-3 py-2 mb-2"
              style={{ background: "#232636" }}
            >
              <p className="text-xs truncate" style={{ color: "#94a3b8" }}>
                <span style={{ color: "#60a5fa" }}>▶ </span>
                {p.currentTaskTitle}
              </p>
            </div>
          )}

          {/* バッジ */}
          <div className="flex items-center gap-2 flex-wrap">
            {p.pendingApprovalCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(250,204,21,0.15)", color: "#facc15" }}
              >
                承認待ち {p.pendingApprovalCount}
              </span>
            )}
            {p.needsRevisionCount > 0 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
              >
                要修正 {p.needsRevisionCount}
              </span>
            )}
            {p.progressPct === 100 && (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
              >
                🎉 完了
              </span>
            )}
            {!p.roadmapId && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "#232636", color: "#4a5568" }}
              >
                未作成
              </span>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
