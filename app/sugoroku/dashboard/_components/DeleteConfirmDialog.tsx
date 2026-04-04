interface DeleteConfirmDialogProps {
  roadmapTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  roadmapTitle,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
    >
      <div
        className="rounded-2xl p-6 w-80"
        style={{ background: "#1a1d27", border: "1px solid #f87171" }}
      >
        <h3 className="font-bold mb-2" style={{ color: "#e2e8f0" }}>
          ロードマップを削除しますか？
        </h3>
        <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
          「{roadmapTitle}」と全タスクが削除されます。この操作は取り消せません。
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: "#232636", color: "#94a3b8" }}
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-bold"
            style={{ background: "#f87171", color: "#fff" }}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
