export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: "admin" | "member";
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: "admin" | "member";
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: "admin" | "member";
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      roadmaps: {
        Row: {
          id: string;
          member_id: string;
          title: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          title: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          title?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          roadmap_id: string;
          parent_id: string | null;
          title: string;
          level: "large" | "medium" | "small" | null;
          order: number | null;
          status: "todo" | "in_progress" | "pending_approval" | "done" | "needs_revision";
          due_date: string | null;
          deliverable_note: string | null;
          description: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          roadmap_id: string;
          parent_id?: string | null;
          title: string;
          level?: "large" | "medium" | "small" | null;
          order?: number | null;
          status?: "todo" | "in_progress" | "pending_approval" | "done" | "needs_revision";
          due_date?: string | null;
          deliverable_note?: string | null;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          roadmap_id?: string;
          parent_id?: string | null;
          title?: string;
          level?: "large" | "medium" | "small" | null;
          order?: number | null;
          status?: "todo" | "in_progress" | "pending_approval" | "done" | "needs_revision";
          due_date?: string | null;
          deliverable_note?: string | null;
          description?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      approval_requests: {
        Row: {
          id: string;
          task_id: string;
          requested_by: string | null;
          reviewed_by: string | null;
          status: "pending" | "approved" | "rejected";
          comment: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          requested_by?: string | null;
          reviewed_by?: string | null;
          status?: "pending" | "approved" | "rejected";
          comment?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          requested_by?: string | null;
          reviewed_by?: string | null;
          status?: "pending" | "approved" | "rejected";
          comment?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      daily_reports: {
        Row: {
          id: string;
          member_id: string | null;
          roadmap_id: string | null;
          body: string;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id?: string | null;
          roadmap_id?: string | null;
          body: string;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string | null;
          roadmap_id?: string | null;
          body?: string;
          date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      roadmap_generations: {
        Row: {
          id: string;
          roadmap_id: string | null;
          created_by: string | null;
          input_text: string;
          output_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          roadmap_id?: string | null;
          created_by?: string | null;
          input_text: string;
          output_json?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          roadmap_id?: string | null;
          created_by?: string | null;
          input_text?: string;
          output_json?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Roadmap = Database["public"]["Tables"]["roadmaps"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type ApprovalRequest = Database["public"]["Tables"]["approval_requests"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];
export type RoadmapGeneration = Database["public"]["Tables"]["roadmap_generations"]["Row"];

export type TaskStatus = Task["status"];
export type MemberRole = Member["role"];
