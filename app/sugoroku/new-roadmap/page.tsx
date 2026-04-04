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
      let errMsg = "生成に失敗しました";
      try {
        const text = await res.text();
        if (text) {
          const err = JSON.parse(text);
          errMsg = err.error ?? errMsg;
        } else {
          errMsg = `サーバーエラー (${res.status})`;
        }
      } catch {
        errMsg = `サーバーエラー (${res.status})`;
      }
      setError(errMsg);
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
    setError(null);
    const supabase = createClient();

    // 1. ロードマップを作成
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

    // 2. 大タスクを INSERT → 返却された id を取得
    const { data: insertedLarge, error: largeErr } = await supabase
      .from("tasks")
      .insert(
        tasks.map((t, i) => ({
          roadmap_id: roadmap.id,
          title: t.title,
          level: t.level,
          order: i + 1,
          status: "todo" as const,
        }))
      )
      .select("id, title");
    if (largeErr || !insertedLarge) {
      setError("タスクの保存に失敗しました: " + largeErr?.message);
      setSaving(false);
      return;
    }

    // 3. 子タスク（中・小）を parent_id 付きで INSERT
    type ChildRow = {
      roadmap_id: string;
      parent_id: string | null;
      title: string;
      level: "large" | "medium" | "small";
      order: number;
      status: "todo";
      _parentTitle?: string;
    };
    const childRows: ChildRow[] = tasks.flatMap((t, i) => {
      const parentId = insertedLarge[i]?.id;
      if (!parentId) return [];
      return (t.children ?? []).flatMap((child, ci) => {
        const mediumRow = {
          roadmap_id: roadmap.id,
          parent_id: parentId,
          title: child.title,
          level: child.level,
          order: ci + 1,
          status: "todo" as const,
        };
        const grandchildRows = (child.children ?? []).map((gc, gci) => ({
          roadmap_id: roadmap.id,
          parent_id: null as string | null, // 中タスクのIDが必要なため後で処理
          title: gc.title,
          level: gc.level,
          order: gci + 1,
          status: "todo" as const,
          _parentTitle: child.title, // 中タスクとの紐付け用（仮）
        }));
        return [mediumRow, ...grandchildRows];
      });
    });

    // 中タスクのみ先に INSERT して id を取得し、小タスクに parent_id をセット
    const mediumRows = childRows.filter((r) => r.level === "medium");
    const smallRowsWithParentTitle = childRows.filter((r) => r.level === "small");

    if (mediumRows.length > 0) {
      const { data: insertedMedium, error: mediumErr } = await supabase
        .from("tasks")
        .insert(mediumRows.map(({ _parentTitle: _, ...rest }) => rest))
        .select("id, title");
      if (mediumErr) {
        setError("中タスクの保存に失敗しました: " + mediumErr.message);
        setSaving(false);
        return;
      }

      // 小タスクに正しい parent_id をセット
      if (smallRowsWithParentTitle.length > 0 && insertedMedium) {
        const titleToId = Object.fromEntries(
          insertedMedium.map((m) => [m.title, m.id])
        );
        const smallRows = smallRowsWithParentTitle.map(({ _parentTitle, ...rest }) => ({
          ...rest,
          parent_id: titleToId[_parentTitle as string] ?? null,
        }));
        const { error: smallErr } = await supabase.from("tasks").insert(smallRows);
        if (smallErr) {
          setError("小タスクの保存に失敗しました: " + smallErr.message);
          setSaving(false);
          return;
        }
      }
    }

    // 4. 生成ログを保存
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
