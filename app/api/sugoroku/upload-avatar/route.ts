import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 400 });

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "ファイルサイズは 2MB 以下にしてください" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `avatars/${user.id}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: uploadError } = await adminClient.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = adminClient.storage.from("avatars").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  await adminClient
    .from("members")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  return NextResponse.json({ url: publicUrl });
}
