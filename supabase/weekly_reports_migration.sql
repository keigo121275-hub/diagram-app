-- ============================================================
-- 週報機能 マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

-- 1. weekly_reports テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_start_date  date NOT NULL,
  main_events      text,
  actions          text,
  last_week_results text,
  what_went_well   text,
  improvements     text,
  next_actions     text,
  status           text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted')),
  created_at       timestamp with time zone DEFAULT now(),
  updated_at       timestamp with time zone DEFAULT now(),
  UNIQUE (member_id, week_start_date)
);

-- 2. updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION update_weekly_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_weekly_reports_updated_at();

-- 3. weekly_reports RLS 有効化
-- ============================================================
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

-- メンバー: 自分の週報を読み書き
CREATE POLICY "members_own_weekly_reports_select"
  ON weekly_reports FOR SELECT
  USING (auth.uid() = member_id OR public.is_admin());

CREATE POLICY "members_own_weekly_reports_insert"
  ON weekly_reports FOR INSERT
  WITH CHECK (auth.uid() = member_id);

CREATE POLICY "members_own_weekly_reports_update"
  ON weekly_reports FOR UPDATE
  USING (auth.uid() = member_id);

CREATE POLICY "members_own_weekly_reports_delete"
  ON weekly_reports FOR DELETE
  USING (auth.uid() = member_id);

-- 4. daily_reports RLS にメンバー自身の閲覧ポリシーを追加
--    (既存の admin 閲覧ポリシーはそのまま残す)
-- ============================================================
CREATE POLICY "members_own_daily_reports_select"
  ON daily_reports FOR SELECT
  USING (auth.uid() = member_id);
