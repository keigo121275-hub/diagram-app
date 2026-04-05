# すごろくロードマップアプリ — コードレビュー依頼書

## 概要

このドキュメントは、Next.js App Router + Supabase で構築した「すごろくロードマップ」アプリの全体像と実装詳細をまとめたものです。  
サブエージェントによるコードレビューを依頼するために作成しています。

---

## スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js (App Router / Turbopack) |
| DB / Auth / Storage / Realtime | Supabase (PostgreSQL) |
| スタイリング | Tailwind CSS |
| ドラッグ＆ドロップ | dnd-kit |
| AI ロードマップ生成 | Anthropic Claude (claude-opus-4-5) |
| デプロイ | Vercel |

---

## ディレクトリ構成

```
app/
  sugoroku/
    layout.tsx                  # ルートレイアウト（ダーク背景 #0f1117）
    login/page.tsx              # メール/パスワードログイン
    dashboard/
      page.tsx                  # サーバーコンポーネント：メンバー・ロードマップ・タスク取得
      _components/
        SugorokuBoard.tsx       # メインボードコンテナ（Realtime 購読あり）
        SugorokuGrid.tsx        # 3列グリッド（dnd-kit, トークンホップアニメ）
        TaskCell.tsx            # 1マス分の表示（START/GOAL, ステータス色, PlayerToken）
        TaskDetailPanel.tsx     # 右パネル：タスク詳細・サブタスク・承認・コメント
        CommentSubPanel.tsx     # コメントスレッドパネル
        BoardHeader.tsx         # ロードマップタイトル・ステージミッション編集
        ProgressBar.tsx         # EXP バー・ランク表示・confetti
        LevelUpToast.tsx        # ランクアップ通知トースト
        Navbar.tsx              # ナビバー（承認件数・要再挑戦件数バッジ）
        MemberTabs.tsx          # 管理者用メンバー切り替えタブ
        PlayerToken.tsx         # 現在地表示アバター
        DeleteConfirmDialog.tsx # 全削除確認ダイアログ
        DailyReportModal.tsx    # 日報入力モーダル
        ProfileModal.tsx        # アバター・表示名編集
    admin/
      approval/                 # 承認キュー（サーバー取得 → ApprovalList）
      members/                  # メンバー管理（作成・削除・ロール変更）
      progress/                 # 全員進捗概覧
      daily-reports/            # 日報一覧（週ナビ・メンバーフィルタ）
    new-roadmap/
      page.tsx                  # AI ロードマップ生成ウィザード（4ステップ）
      _components/              # StepInput / StepLoading / StepPreview / StepComplete
    _lib/
      types.ts                  # RoadmapWithTasks 型定義
      constants.ts              # RANK_TIERS, QUEST_STATUS_LABELS, STATUS_COLORS など

lib/supabase/
  types.ts     # Database interface 全体（全テーブル型）
  server.ts    # SSR 用 createClient
  client.ts    # ブラウザ用 createClient

app/api/sugoroku/
  generate-roadmap/route.ts     # POST: Claude でロードマップ JSON 生成
  upload-avatar/route.ts        # POST: Storage アバターアップロード
  create-member/route.ts        # POST: Auth admin でユーザー作成
  delete-member/route.ts        # DELETE: Auth admin でユーザー削除
  update-member-role/route.ts   # PATCH: スーパー管理者限定ロール変更

proxy.ts   # /sugoroku/:path* の認証・ロールガード（Middleware 相当）
```

---

## データベーススキーマ

### `members`
| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid PK | |
| name | text | 表示名 |
| email | text | |
| role | `admin` \| `member` | |
| avatar_url | text \| null | Storage 公開 URL |
| created_at | timestamptz | |

### `roadmaps`
| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid PK | |
| member_id | uuid FK→members | |
| title | text | |
| description | text \| null | ステージミッション（目標） |
| created_at | timestamptz | |

### `tasks`
| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid PK | |
| roadmap_id | uuid FK→roadmaps | |
| parent_id | uuid \| null | 大→中→小 の親子関係 |
| title | text | |
| level | `large` \| `medium` \| `small` \| null | |
| order | integer | 並び順 |
| status | `todo` \| `in_progress` \| `pending_approval` \| `done` \| `needs_revision` | |
| due_date | date \| null | |
| deliverable_note | text \| null | 完了時の成果物メモ |
| description | text \| null | メモ・リンク（中/小タスク） |
| created_by | uuid \| null | |
| created_at | timestamptz | |

### `approval_requests`
| カラム | 型 |
|--------|----|
| id | uuid PK |
| task_id | uuid FK→tasks |
| requested_by | uuid FK→members |
| reviewed_by | uuid \| null |
| status | `pending` \| `approved` \| `rejected` |
| comment | text \| null |
| created_at | timestamptz |
| reviewed_at | timestamptz \| null |

### `comments`
| カラム | 型 |
|--------|----|
| id | uuid PK |
| task_id | uuid FK→tasks |
| author_id | uuid FK→members |
| body | text |
| created_at | timestamptz |

### `daily_reports`
| カラム | 型 |
|--------|----|
| id | uuid PK |
| member_id | uuid FK→members |
| roadmap_id | uuid FK→roadmaps |
| body | text |
| date | date |
| created_at | timestamptz |

### `roadmap_generations`
| カラム | 型 |
|--------|----|
| id | uuid PK |
| roadmap_id | uuid FK→roadmaps |
| created_by | uuid FK→members |
| input_text | text |
| output_json | jsonb |
| created_at | timestamptz |

---

## アーキテクチャ・データフロー

### 認証・ルーティング
- `proxy.ts` が `/sugoroku/:path*` をガード
  - 未ログイン → `/sugoroku/login`
  - `/sugoroku/admin/*` または `/sugoroku/new-roadmap` は `role === "admin"` のみ
- Supabase SSR (`@supabase/ssr`) でクッキーベースのセッション管理

### ダッシュボードのデータフロー
1. `dashboard/page.tsx`（サーバー） → メンバー・ロードマップ・タスクを一括取得
2. `SugorokuBoard` で `localTasksMap`（楽観的更新用ローカル state）を保持
3. Supabase Realtime で `tasks` テーブルを `roadmap_id` フィルタ購読 → ローカル state を差分更新（`router.refresh()` を呼ばない設計で軽量化）
4. `parent_id === null` の大タスクのみグリッドに表示
5. `TaskDetailPanel` には全タスク（大・中・小）を渡して階層表示

### AI ロードマップ生成フロー
1. 管理者が `new-roadmap` ページでテキスト入力
2. `/api/sugoroku/generate-roadmap` に POST → Claude に JSON 生成を依頼
3. クライアントで大タスク→中タスク→小タスクの順に Supabase Insert
4. 生成ログを `roadmap_generations` に記録

### 承認フロー
1. メンバーが `TaskDetailPanel` で「✨ クリア申請する」→ `approval_requests`(pending) + tasks(pending_approval)
2. 管理者が `/admin/approval` で承認 → tasks(done) / 却下 → tasks(needs_revision) + コメント保存

---

## 主要コンポーネントの詳細

### SugorokuBoard.tsx
- **役割:** ボード全体の状態管理・Realtime 制御
- **主要 state:** `selectedMemberId`, `localTasksMap`, `showDailyReport`, `confirmDeleteAll`
- **主要関数:**
  - `sortTasks`: order 順ソート
  - `handleReorder`: dnd-kit のドロップ後に order を DB 更新
  - `handleTaskUpdated`: パネルからのタスク更新を localTasksMap に反映
  - Realtime `useEffect`: INSERT/UPDATE/DELETE をローカル state に差分適用

### SugorokuGrid.tsx
- **役割:** 大タスクを 3列グリッドで表示、ドラッグ並び替え、詳細パネル開閉
- **主要 state:** `selectedTask`, `hopState`（トークンホップアニメ用）
- **currentIndex:** `done` タスクの最後のインデックスを計算して PlayerToken の位置決め
- **トークンホップアニメ:** `currentIndex` 変化時に前後のセルの `getBoundingClientRect` で fixed overlay を動かす

### TaskDetailPanel.tsx
- **役割:** 大タスクの詳細＋中・小タスクの CRUD・ステータス変更・承認申請・コメント
- **新機能（今回実装）:** 中・小タスクの `📝 メモ・リンク` 欄（`description` カラムを流用）
  - `onBlur` のタイミングで自動保存
  - `renderWithLinks()` で URL を `<a>` タグに自動変換
- **memoValues state:** `{ [taskId]: string }` でローカル管理

### TaskCell.tsx
- **今回の変更:**
  - `minHeight`: 92px → **140px**
  - タイトルフォント: `text-xs` → **`text-sm`**
  - パディング: `p-3` → **`p-4`**

### SugorokuGrid.tsx
- **今回の変更:**
  - `COLS`: 5 → **3**（列数削減で横幅ゆったり）

---

## constants.ts の主要定義

```typescript
// ランクティア（進捗 % に応じてアイコン・称号が変わる）
export const RANK_TIERS = [
  { min: 0,   icon: "🌱", title: "見習い冒険者",  color: "#94a3b8" },
  { min: 25,  icon: "🗺️", title: "一人前の旅人",  color: "#60a5fa" },
  { min: 50,  icon: "⚔️", title: "熟練の探索者", color: "#a78bfa" },
  { min: 75,  icon: "🌟", title: "歴戦の勇者",   color: "#facc15" },
  { min: 100, icon: "👑", title: "伝説の英雄",    color: "#4ade80" },
];

// ゲーム UI 用ステータスラベル
export const QUEST_STATUS_LABELS = {
  todo:             "📋 受注待ち",
  in_progress:      "⚔️ 挑戦中",
  pending_approval: "✨ 審判待ち",
  done:             "🏆 達成",
  needs_revision:   "🔄 再挑戦",
};
```

---

## 既知の課題・確認してほしい点

1. **dnd-kit hydration 対策** — `DndContext` に固定 `id` を付与して SSR/CSR の ID 不一致を解消済み。他に潜在的な hydration リスクがないか確認したい。

2. **Realtime 差分更新のロジック** — `SugorokuBoard.tsx` の `useEffect` で INSERT/UPDATE/DELETE を局所的に state 更新している。エッジケース（並列更新、削除後の INSERT など）で整合性が崩れないか確認したい。

3. **memoValues の初期化** — `TaskDetailPanel` の `memoValues` は `allTasks` を元に初期化しているが、パネルを開いたまま他のメンバーが同じタスクのメモを更新した場合に上書きされないか確認したい。

4. **description カラムの二重利用** — 大タスクの `description`（プロジェクト概要）と、中・小タスクの `description`（メモ/リンク）は同じカラムを使用。設計上の整合性を確認したい。

5. **パフォーマンス** — `TaskDetailPanel` は多数の state を持つ大きなコンポーネント。分割・最適化の余地を確認したい。

6. **モバイル対応** — 現状デスクトップ向けのレイアウト。レスポンシブ対応の優先度と方針を検討したい。

---

## レビュー時に特に見てほしいファイル

優先度順:

1. `app/sugoroku/dashboard/_components/SugorokuBoard.tsx` — Realtime + 状態管理の核
2. `app/sugoroku/dashboard/_components/TaskDetailPanel.tsx` — 最も複雑なコンポーネント（1300行超）
3. `app/sugoroku/dashboard/_components/SugorokuGrid.tsx` — グリッド + アニメーション
4. `app/sugoroku/_lib/constants.ts` — 定数・ロジック
5. `proxy.ts` — 認証ガード

---

## 直近のコミット履歴

```
35d66f7 feat: グリッド3列化・セル拡大・メモ/リンク欄追加
cf21ddc feat: ゲームUI 用語・ビジュアル統一（ロードマップ語→すごろく/RPG語）
a5334f3 fix: dnd-kit ハイドレーションエラーを解消（DndContext に固定 id を付与）
a17424f fix: CP バッジ削除・行間コネクター矢印を削除
f12551d fix: タスクの並び順を全行左→右に統一（蛇行グリッドを廃止）
```
