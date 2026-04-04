import type { Task } from "@/lib/supabase/types";

/** ダッシュボードで使うロードマップ（タスク込み）の型 */
export interface RoadmapWithTasks {
  id: string;
  member_id: string;
  title: string;
  description: string | null;
  created_at: string;
  tasks: Task[];
}
