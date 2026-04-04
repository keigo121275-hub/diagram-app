-- ============================================================
-- すごろくロードマップ — Supabase スキーマ
-- Supabase SQL Editor に貼り付けて実行してください
-- ============================================================

-- 1. members
CREATE TABLE IF NOT EXISTS public.members (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- メンバーは自分のレコードを読める。adminは全員読める
CREATE POLICY "members_select" ON public.members
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

-- 自分のレコードのみ更新可（role以外）
CREATE POLICY "members_update_self" ON public.members
  FOR UPDATE USING (auth.uid() = id);

-- adminのみINSERT（新規メンバー招待）
CREATE POLICY "members_insert_admin" ON public.members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );


-- 2. roadmaps
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roadmaps_select" ON public.roadmaps
  FOR SELECT USING (
    member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

CREATE POLICY "roadmaps_insert_admin" ON public.roadmaps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

CREATE POLICY "roadmaps_update_admin" ON public.roadmaps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

CREATE POLICY "roadmaps_delete_admin" ON public.roadmaps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );


-- 3. tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id  uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  title       text NOT NULL,
  level       text CHECK (level IN ('large', 'medium', 'small')),
  "order"     int,
  status      text NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'pending_approval', 'done', 'needs_revision')),
  created_by  uuid REFERENCES public.members(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ロードマップの所有者またはadminが読める
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
          )
        )
    )
  );


-- 4. approval_requests
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL UNIQUE REFERENCES public.tasks(id) ON DELETE CASCADE,
  requested_by  uuid REFERENCES public.members(id),
  reviewed_by   uuid REFERENCES public.members(id),
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  reviewed_at   timestamptz
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

-- 申請者本人またはadminが読める
CREATE POLICY "approvals_select" ON public.approval_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

-- 申請はメンバー自身が行う
CREATE POLICY "approvals_insert" ON public.approval_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

-- 承認・差し戻しはadminのみ
CREATE POLICY "approvals_update_admin" ON public.approval_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );


-- 5. comments
CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES public.members(id),
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- タスクを読める人はコメントも読める
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN public.roadmaps r ON r.id = t.roadmap_id
      WHERE t.id = task_id
        AND (
          r.member_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
          )
        )
    )
  );

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (author_id = auth.uid());


-- 6. roadmap_generations
CREATE TABLE IF NOT EXISTS public.roadmap_generations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id   uuid REFERENCES public.roadmaps(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.members(id),
  input_text   text NOT NULL,
  output_json  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roadmap_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "generations_select_admin" ON public.roadmap_generations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );

CREATE POLICY "generations_insert_admin" ON public.roadmap_generations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members m WHERE m.id = auth.uid() AND m.role = 'admin'
    )
  );


-- ============================================================
-- DB Trigger: auth.users に新規登録時に members を自動作成
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.members (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- Supabase Storage: avatars バケット
-- ============================================================
-- Storage > Buckets で "avatars" を作成し、Public bucket に設定してください。
-- または以下の SQL で作成:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Realtime を有効化する場合は Supabase ダッシュボードの
-- Database > Replication で tasks, comments を有効にしてください。
