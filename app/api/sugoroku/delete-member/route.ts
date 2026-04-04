import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/supabase/types";

export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single() as { data: Pick<Member, "role"> | null; error: unknown };
  if (member?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetUserId } = await request.json();
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId は必須です" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "自分自身は削除できません" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // auth.users を削除すると CASCADE で members も削除される
  const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
