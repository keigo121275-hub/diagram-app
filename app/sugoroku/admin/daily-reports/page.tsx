import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import Navbar from "@/app/sugoroku/dashboard/_components/Navbar";
import DailyReportList from "./_components/DailyReportList";

export type MemberOption = {
  id: string;
  name: string;
};

// ReportItem は DailyReportList 側で定義するため page からは export しない

export default async function DailyReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sugoroku/login");

  // auth + admin check + allMembers を並列で取得（週ナビには不要なため1回だけ）
  const [{ data: memberData }, { data: allMembersData }] = await Promise.all([
    supabase.from("members").select("*").eq("id", user.id).single(),
    supabase.from("members").select("id, name").order("name"),
  ]);

  const member = memberData as Member | null;
  if (member?.role !== "admin") redirect("/sugoroku/dashboard");

  const allMembers: MemberOption[] = (allMembersData ?? []) as MemberOption[];

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ color: "#e2e8f0" }}>
            📝 日報
          </h1>
          <p className="text-sm mt-1" style={{ color: "#94a3b8" }}>
            メンバーの週次進捗を確認する
          </p>
        </div>
        <DailyReportList
          allMembers={allMembers}
          initialMemberId={allMembers[0]?.id ?? ""}
        />
      </main>
    </div>
  );
}
