import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/supabase/types";
import type { RoadmapWithTasks } from "@/app/sugoroku/_lib/types";
import SugorokuBoard from "./_components/SugorokuBoard";
import Navbar from "./_components/Navbar";

export default async function DashboardPage() {
  const supabase = await createClient();
  const authResult = await supabase.auth.getUser();
  const user = authResult.data.user;

  if (!user) {
    redirect("/sugoroku/login");
    return null;
  }

  const memberResult = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();
  const member = (memberResult.data ?? null) as Member | null;

  let allMembers: Pick<Member, "id" | "name" | "email" | "avatar_url" | "role">[] = [];
  if (member?.role === "admin") {
    const membersResult = await supabase
      .from("members")
      .select("id, name, email, avatar_url, role");
    allMembers = (membersResult.data ?? []) as typeof allMembers;
  }

  const roadmapsResult = await supabase
    .from("roadmaps")
    .select("*, tasks(*)")
    .order("created_at", { ascending: false });
  const roadmaps = (roadmapsResult.data ?? []) as unknown as RoadmapWithTasks[];

  return (
    <div className="min-h-screen" style={{ background: "#0f1117" }}>
      <Navbar member={member} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <SugorokuBoard
          currentMember={member}
          allMembers={allMembers}
          roadmaps={roadmaps}
        />
      </main>
    </div>
  );
}
