"use client";

import React from "react";

function renderWithLinks(text: string): React.ReactNode[] {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "#60a5fa", textDecoration: "underline", wordBreak: "break-all" }}
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

interface MemoLinkFieldProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  /** textarea の行数（省略時 2） */
  rows?: number;
  /** コンテナの追加スタイル */
  compact?: boolean;
}

export default function MemoLinkField({
  value,
  onChange,
  onBlur,
  placeholder = "メモや参考URLを入力...",
  rows = 2,
  compact = false,
}: MemoLinkFieldProps) {
  const labelSize = compact ? "10px" : undefined;
  const textSize = compact ? "11px" : "12px";

  return (
    <div
      className={compact ? "mt-2 rounded-md p-2" : "mx-1 mt-2 rounded-lg p-2.5"}
      style={
        compact
          ? { background: "#0f1117", border: "1px dashed rgba(108,99,255,0.2)" }
          : { background: "#141622", border: "1px solid rgba(108,99,255,0.2)" }
      }
    >
      <div
        className="font-bold mb-1.5"
        style={{ fontSize: labelSize ?? "12px", color: "#6c63ff" }}
      >
        📝 メモ・リンク
      </div>

      {value ? (
        <div>
          <div
            className="leading-relaxed"
            style={{
              fontSize: textSize,
              color: compact ? "#94a3b8" : "#cbd5e1",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              marginBottom: compact ? "4px" : undefined,
              lineHeight: compact ? 1.6 : undefined,
            }}
          >
            {renderWithLinks(value)}
          </div>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            rows={rows}
            className="w-full outline-none resize-none mt-1.5"
            style={
              compact
                ? { background: "transparent", border: "none", color: "#6b7280", fontSize: "11px" }
                : {
                    background: "#0f1117",
                    border: "1px solid #2e3347",
                    borderRadius: "6px",
                    padding: "6px 8px",
                    color: "#cbd5e1",
                    fontSize: textSize,
                  }
            }
          />
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={rows}
          className="w-full outline-none resize-none"
          style={{ background: "transparent", color: "#94a3b8", border: "none", fontSize: textSize }}
        />
      )}
    </div>
  );
}
