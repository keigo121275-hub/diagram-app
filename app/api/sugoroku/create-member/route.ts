import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  // 呼び出し元が admin か確認
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();
  if (member?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "名前・メール・パスワードは必須です" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "パスワードは6文字以上にしてください" }, { status: 400 });
  }

  // service_role キーで管理者クライアントを作成
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ユーザー作成（DBトリガーで members も自動作成される）
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // DB トリガーが走るまで少し待ってから name を更新
  await new Promise((r) => setTimeout(r, 500));
  await adminClient
    .from("members")
    .update({ name })
    .eq("id", newUser.user.id);

  return NextResponse.json({ success: true, userId: newUser.user.id });
}
