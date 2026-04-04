interface BoardHeaderProps {
  title: string;
  isAdmin: boolean;
  hasRoadmap: boolean;
  deletingAll: boolean;
  onDeleteAllClick: () => void;
}

export function BoardHeader({
  title,
  isAdmin,
  hasRoadmap,
  deletingAll,
  onDeleteAllClick,
}: BoardHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold" style={{ color: "#e2e8f0" }}>
          {title}
        </h2>
        {isAdmin && (
          <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
            管理者ビュー — メンバーのロードマップを確認できます
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isAdmin && hasRoadmap && (
          <button
            onClick={onDeleteAllClick}
            disabled={deletingAll}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              color: "#f87171",
            }}
          >
            {deletingAll ? "削除中..." : "🗑️ 全タスク削除"}
          </button>
        )}

        {isAdmin && (
          <a
            href="/sugoroku/new-roadmap"
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: "linear-gradient(135deg, #6c63ff, #5b52ee)",
              color: "#fff",
            }}
          >
            ✨ 新規生成
          </a>
        )}
      </div>
    </div>
  );
}
