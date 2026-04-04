"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/supabase/types";

interface NavbarProps {
  member: Member | null;
}

export default function Navbar({ member }: NavbarProps) {
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (member?.role !== "admin") return;
    const supabase = createClient();
    supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count ?? 0));
  }, [member?.role]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sugoroku/login");
    router.refresh();
  };

  const initials = member?.name
    ? member.name.slice(0, 2).toUpperCase()
    : "??";

  return (
    <nav
      className="sticky top-0 z-40 px-6 py-3 flex items-center justify-between"
      style={{
        background: "rgba(26, 29, 39, 0.95)",
        borderBottom: "1px solid #2e3347",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* ロゴ */}
      <a href="/sugoroku/dashboard" className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: "linear-gradient(135deg, #6c63ff, #4ade80)" }}
        >
          🎲
        </div>
        <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>
          すごろくロードマップ
        </span>
        {member?.role === "admin" && (
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: "rgba(108,99,255,0.2)", color: "#6c63ff" }}
          >
            管理者
          </span>
        )}
      </a>

      {/* 右側メニュー */}
      <div className="flex items-center gap-4">
        {member?.role === "admin" && (
          <div className="flex items-center gap-4">
            <a
              href="/sugoroku/admin/members"
              className="text-sm transition-colors"
              style={{ color: "#94a3b8" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#e2e8f0")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              メンバー管理
            </a>
            <a
              href="/sugoroku/admin/approval"
              className="relative text-sm transition-colors flex items-center gap-1.5"
              style={{ color: "#94a3b8" }}
              onMouseOver={(e) => (e.currentTarget.style.color = "#e2e8f0")}
              onMouseOut={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              承認リスト
              {pendingCount > 0 && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                  style={{ background: "#f87171", color: "#fff" }}
                >
                  {pendingCount}
                </span>
              )}
            </a>
          </div>
        )}

        {/* アバター */}
        <div className="flex items-center gap-2">
          {member?.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.name}
              className="w-8 h-8 rounded-full object-cover"
              style={{ border: "2px solid #2e3347" }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: "linear-gradient(135deg, #6c63ff, #4ade80)",
                color: "#fff",
              }}
            >
              {initials}
            </div>
          )}
          <span className="text-sm" style={{ color: "#e2e8f0" }}>
            {member?.name ?? "ゲスト"}
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: "#232636",
            color: "#94a3b8",
            border: "1px solid #2e3347",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#e2e8f0";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
          }}
        >
          ログアウト
        </button>
      </div>
    </nav>
  );
}
