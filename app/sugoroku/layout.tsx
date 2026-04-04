import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "すごろくロードマップ",
  description: "育成進捗をすごろく形式で管理する社内ツール",
};

export default function SugorokuLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily:
          '"Helvetica Neue", "Hiragino Sans", "Yu Gothic UI", sans-serif',
      }}
    >
      {children}
    </div>
  );
}
