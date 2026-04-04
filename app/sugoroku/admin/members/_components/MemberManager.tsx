"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Member } from "@/lib/supabase/types";

interface MemberManagerProps {
  members: Member[];
}

export default function MemberManager({ members }: MemberManagerProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (target: Member) => {
    if (!confirm(`「${target.name}」を削除しますか？\nロードマップ・タスクも全て削除されます。`)) return;
    setDeletingId(target.id);
    const res = await fetch("/api/sugoroku/delete-member", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: target.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "削除に失敗しました");
    } else {
      router.refresh();
    }
    setDeletingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const res = await fetch("/api/sugoroku/create-member", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "作成に失敗しました");
    } else {
      setSuccess(`${name} さんを追加しました。ログイン情報をメンバーに伝えてください。`);
      setName("");
      setEmail("");
      setPassword("");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* 新規作成フォーム */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "#e2e8f0" }}>
          新しいメンバーを追加
        </h2>

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

        {success && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.3)",
              color: "#4ade80",
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "#94a3b8" }}>
              名前
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="田中 太郎"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "#232636",
                border: "1px solid #2e3347",
                color: "#e2e8f0",
              }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#94a3b8" }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tanaka@example.com"
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "#232636",
                border: "1px solid #2e3347",
                color: "#e2e8f0",
              }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "#94a3b8" }}>
              初期パスワード（6文字以上）
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none pr-12"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "#64748b" }}
              >
                {showPassword ? "隠す" : "表示"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold mt-2"
            style={{
              background: loading
                ? "#232636"
                : "linear-gradient(135deg, #6c63ff, #5b52ee)",
              color: loading ? "#4a5568" : "#fff",
            }}
          >
            {loading ? "作成中..." : "メンバーを追加する"}
          </button>
        </form>
      </div>

      {/* メンバー一覧 */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "#e2e8f0" }}>
          メンバー一覧（{members.length}名）
        </h2>
        <div className="space-y-2">
          {members.map((m) => {
            const initials = m.name.slice(0, 2).toUpperCase();
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "#232636" }}
              >
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt={m.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #6c63ff, #4ade80)",
                      color: "#fff",
                    }}
                  >
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#e2e8f0" }}>
                    {m.name}
                  </p>
                  <p className="text-xs truncate" style={{ color: "#64748b" }}>
                    {m.email}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded shrink-0"
                  style={{
                    background:
                      m.role === "admin"
                        ? "rgba(108,99,255,0.2)"
                        : "rgba(148,163,184,0.1)",
                    color: m.role === "admin" ? "#6c63ff" : "#94a3b8",
                  }}
                >
                  {m.role === "admin" ? "管理者" : "メンバー"}
                </span>
                {m.role !== "admin" && (
                  <button
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 transition-all"
                    style={{
                      background: "rgba(248,113,113,0.1)",
                      color: "#f87171",
                      border: "1px solid rgba(248,113,113,0.2)",
                      opacity: deletingId === m.id ? 0.5 : 1,
                    }}
                    title="削除"
                  >
                    {deletingId === m.id ? "..." : "✕"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
