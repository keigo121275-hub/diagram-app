"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Member } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/types";
import { StepInput } from "./_components/StepInput";
import { StepLoading } from "./_components/StepLoading";
import { StepPreview } from "./_components/StepPreview";
import { StepComplete } from "./_components/StepComplete";

type GeneratedTask = {
  title: string;
  level: "large" | "medium" | "small";
  order: number;
  children?: GeneratedTask[];
};

type GenerateResult = {
  roadmap_title: string;
  tasks: GeneratedTask[];
};

export default function NewRoadmapPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [duration, setDuration] = useState("3ヶ月");
  const [inputText, setInputText] = useState("");
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("members").select("*").then(({ data }) => {
      setMembers((data as Member[]) ?? []);
      if (data && data.length > 0) setSelectedMemberId(data[0].id);
    });
  }, []);

  const handleGenerate = async () => {
    setError(null);
    setStep(2);
    const res = await fetch("/api/sugoroku/generate-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inputText, duration }),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error ?? "生成に失敗しました");
      setStep(1);
      return;
    }
    const data: GenerateResult = await res.json();
    setResult(data);
    setTasks(data.tasks.map((t, i) => ({ ...t, order: i + 1 })));
    setStep(3);
  };

  const handleSave = async () => {
    if (!selectedMemberId || !result) return;
    setSaving(true);
    const supabase = createClient();
    const { data: roadmap, error: rmErr } = await supabase
      .from("roadmaps")
      .insert({ member_id: selectedMemberId, title: result.roadmap_title })
      .select()
      .single();
    if (rmErr || !roadmap) {
      setError("ロードマップの保存に失敗しました: " + rmErr?.message);
      setSaving(false);
      return;
    }
    const { error: tasksErr } = await supabase.from("tasks").insert(
      tasks.map((t, i) => ({
        roadmap_id: roadmap.id,
        title: t.title,
        level: t.level,
        order: i + 1,
        status: "todo" as const,
      }))
    );
    if (tasksErr) {
      setError("タスクの保存に失敗しました: " + tasksErr.message);
      setSaving(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("roadmap_generations").insert({
      roadmap_id: roadmap.id,
      created_by: user?.id,
      input_text: inputText,
      output_json: result as unknown as Json,
    });
    setStep(4);
    setSaving(false);
  };

  const handleReset = () => {
    setStep(1);
    setInputText("");
    setResult(null);
    setTasks([]);
    setError(null);
  };

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  if (step === 1)
    return (
      <StepInput
        members={members}
        selectedMemberId={selectedMemberId}
        duration={duration}
        inputText={inputText}
        error={error}
        onMemberChange={setSelectedMemberId}
        onDurationChange={setDuration}
        onTextChange={setInputText}
        onGenerate={handleGenerate}
      />
    );

  if (step === 2) return <StepLoading />;

  if (step === 3 && result)
    return (
      <StepPreview
        roadmapTitle={result.roadmap_title}
        memberName={selectedMember?.name}
        duration={duration}
        tasks={tasks}
        saving={saving}
        error={error}
        onTasksChange={setTasks}
        onBack={() => setStep(1)}
        onSave={handleSave}
      />
    );

  if (step === 4)
    return (
      <StepComplete
        memberName={selectedMember?.name}
        onGoToDashboard={() => router.push("/sugoroku/dashboard")}
        onGenerateAnother={handleReset}
      />
    );

  return null;
}
