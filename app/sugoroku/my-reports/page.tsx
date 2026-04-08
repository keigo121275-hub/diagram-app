import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import MyReportsClient from "./_components/MyReportsClient";

export default async function MyReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sugoroku/login");

  const { data: memberData } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  const member = memberData as Member | null;
  if (!member) redirect("/sugoroku/login");

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            📝 日報・週報
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            日報の確認と週報の自動生成
          </p>
        </div>
        <MyReportsClient memberId={member.id} />
      </main>
    </div>
  );
}
