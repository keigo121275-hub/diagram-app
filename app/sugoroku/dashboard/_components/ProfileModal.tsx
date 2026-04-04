"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/supabase/types";

interface ProfileModalProps {
  member: Member;
  onClose: () => void;
  onUpdated: (newAvatarUrl: string) => void;
}

export default function ProfileModal({ member, onClose, onUpdated }: ProfileModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(member.avatar_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(member.name ?? "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("ファイルサイズは 2MB 以下にしてください");
      return;
    }

    setError(null);
    setUploading(true);

    // プレビューを即時表示
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);

    // サーバー経由でアップロード
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/sugoroku/upload-avatar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "アップロードに失敗しました");
      setPreview(member.avatar_url ?? null);
      setUploading(false);
      return;
    }

    onUpdated(data.url);
    setUploading(false);
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === member.name) return;
    setSavingName(true);
    const supabase = createClient();
    await supabase.from("members").update({ name: trimmed }).eq("id", member.id);
    setSavingName(false);
  };

  const initials = member.name ? member.name.slice(0, 2).toUpperCase() : "??";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#1a1d27", border: "1px solid #2e3347" }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-base" style={{ color: "#e2e8f0" }}>
            プロフィール編集
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none"
            style={{ color: "#64748b" }}
          >
            ×
          </button>
        </div>

        {/* アバター */}
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative">
            {preview ? (
              <img
                src={preview}
                alt="avatar"
                className="w-24 h-24 rounded-full object-cover"
                style={{ border: "3px solid #2e3347" }}
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold"
                style={{
                  background: "linear-gradient(135deg, #6c63ff, #4ade80)",
                  color: "#fff",
                }}
              >
                {initials}
              </div>
            )}
            {uploading && (
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                <span className="text-xs" style={{ color: "#fff" }}>
                  uploading...
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-4 py-2 rounded-xl text-xs font-medium transition-all"
            style={{
              background: "rgba(108,99,255,0.15)",
              border: "1px solid rgba(108,99,255,0.4)",
              color: "#6c63ff",
              opacity: uploading ? 0.5 : 1,
            }}
          >
            {uploading ? "アップロード中..." : "写真を変更する"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && (
            <p className="text-xs" style={{ color: "#f87171" }}>
              {error}
            </p>
          )}
        </div>

        {/* 名前編集 */}
        <div className="mb-4">
          <label className="block text-xs mb-1.5 font-medium" style={{ color: "#94a3b8" }}>
            表示名
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: "#232636",
              border: "1px solid #2e3347",
              color: "#e2e8f0",
            }}
          />
          {savingName && (
            <p className="text-xs mt-1" style={{ color: "#4a5568" }}>
              保存中...
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#232636", color: "#94a3b8", border: "1px solid #2e3347" }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
