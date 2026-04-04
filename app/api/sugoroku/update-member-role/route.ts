import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/supabase/types";

const SUPER_ADMIN_EMAIL = "keigo121275@gmail.com";

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.email !== SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "スーパー管理者のみロール変更できます" }, { status: 403 });
  }

  const { targetUserId, role } = await request.json() as { targetUserId: string; role: "admin" | "member" };
  if (!targetUserId || !role) {
    return NextResponse.json({ error: "targetUserId と role は必須です" }, { status: 400 });
  }
  if (role !== "admin" && role !== "member") {
    return NextResponse.json({ error: "role は admin か member のみ指定できます" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await adminClient
    .from("members")
    .update({ role })
    .eq("id", targetUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
