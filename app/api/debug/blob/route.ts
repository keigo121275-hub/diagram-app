import { NextResponse } from "next/server";

export async function GET() {
  const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.slice(0, 30) ?? "未設定";

  try {
    const { list, put } = await import("@vercel/blob");

    // テスト書き込み
    let writeResult = "未実施";
    try {
      await put("debug-test.json", JSON.stringify({ ok: true, ts: Date.now() }), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
      });
      writeResult = "成功";
    } catch (e: unknown) {
      writeResult = `失敗: ${(e as Error).message}`;
    }

    // 全 Blob を一覧
    const { blobs } = await list();

    return NextResponse.json({
      BLOB_TOKEN_PREFIX: tokenPrefix,
      writeResult,
      blobCount: blobs.length,
      blobs: blobs.map((b) => ({ pathname: b.pathname, url: b.url, size: b.size })),
    });
  } catch (e: unknown) {
    return NextResponse.json({
      BLOB_TOKEN_PREFIX: tokenPrefix,
      error: (e as Error).message,
    });
  }
}
