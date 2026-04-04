import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import MemberManager from "./_components/MemberManager";

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sugoroku/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();
  const me = memberData as Member | null;
  if (me?.role !== "admin") redirect("/sugoroku/dashboard");

  const { data: allMembers } = await supabase
    .from("members")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={me} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            メンバー管理
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            新しいメンバーを追加したり、既存メンバーを確認できます
          </p>
        </div>
        <MemberManager members={(allMembers ?? []) as Member[]} currentUserEmail={user.email ?? ""} />
      </main>
    </div>
  );
}
