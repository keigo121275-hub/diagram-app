"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SugorokuLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
      return;
    }

    router.push("/sugoroku/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#0f1117" }}>
      <div className="w-full max-w-sm">

        {/* ロゴ */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #6c63ff, #4ade80)" }}
          >
            <span className="text-2xl">🎲</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            すごろくロードマップ
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            育成進捗管理ツール
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleLogin}>
          <div
            className="rounded-2xl p-6"
            style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
          >
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6c63ff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2e3347")}
                placeholder="you@example.com"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: "#94a3b8" }}>
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "#232636",
                  border: "1px solid #2e3347",
                  color: "#e2e8f0",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#6c63ff")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#2e3347")}
                placeholder="••••••••"
              />
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
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                background: loading ? "#2e3347" : "linear-gradient(135deg, #6c63ff, #5b52ee)",
                color: loading ? "#94a3b8" : "#fff",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </div>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#94a3b8" }}>
          アカウントの発行は管理者にお問い合わせください
        </p>
      </div>
    </div>
  );
}
