import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const nextauthUrl = process.env.NEXTAUTH_URL ?? "";

  return NextResponse.json({
    GOOGLE_CLIENT_ID: clientId
      ? `${clientId.slice(0, 15)}...${clientId.slice(-20)}`
      : "❌ 未設定",
    GOOGLE_CLIENT_SECRET: clientSecret
      ? `${clientSecret.slice(0, 8)}...${clientSecret.slice(-4)}`
      : "❌ 未設定",
    NEXTAUTH_URL: nextauthUrl || "❌ 未設定",
  });
}
