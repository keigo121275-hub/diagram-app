# すごろくロードマップ — ゲームUI デザイン仕様

> ブランチ: `feature/game-ui-redesign`  
> 参照デモ: https://sugoroku-roadmap.surge.sh （タブ ⑥ ✨ ゲームUI（新））

---

## 1. 称号システム（EXP ゲージ）

### ランクティア定義 (`constants.ts` / `RANK_TIERS`)

| 進捗 % | アイコン | 称号 | カラー |
|--------|---------|------|--------|
| 0% | 🌱 | 見習い冒険者 | `#94a3b8` |
| 25% | 🗺️ | 一人前の旅人 | `#60a5fa` |
| 50% | ⚔️ | 熟練の探索者 | `#a78bfa` |
| 75% | 🌟 | 歴戦の勇者 | `#facc15` |
| 100% | 👑 | 伝説の英雄 | `#4ade80` |

### ProgressBar コンポーネント (`ProgressBar.tsx`)

- EXP バー（グラデーション: `#6c63ff → #a78bfa → #4ade80`）
- 25% / 50% / 75% に区切り線
- 各ランクのアイコンをバー上部に配置
- 100% 達成時: canvas-confetti 発火 + 「🎉 全クエスト達成！」メッセージ

### LevelUpToast コンポーネント (`LevelUpToast.tsx`)

- `pct` が増加してランクが上がった瞬間に画面上部からスライドイン
- 3.2 秒後に自動非表示
- 紫グラデーション背景 `#1e1a3a → #2d2660`

---

## 2. マップ風ボード

### セル種別 (`TaskCell.tsx`)

| 条件 | バッジ | ボーダーカラー |
|------|--------|--------------|
| `cellIndex === 0` | 🏁 START | `rgba(74,222,128,0.35)` |
| `cellIndex === totalCells - 1` | 🏆 GOAL | `rgba(250,204,21,0.35)` |
| `(cellIndex + 1) % 5 === 0` | ⭐ CP | `rgba(167,139,250,0.35)` |
| それ以外 | — | 通常 |

- 完了セル（`status === "done"`）: 半透明の ✅ スタンプを背景に表示、タイトル色を `#86efac` に変更
- セル種別バッジはセル上端に `-3px` のオフセットで配置

### 行コネクター (`SugorokuGrid.tsx`)

- 蛇行グリッド（偶数行: 左→右、奇数行: 右→左）
- 行間に `│ ↓` の矢印を表示（方向は行の末尾側）

---

## 3. コマホップアニメーション (`SugorokuGrid.tsx`)

- `currentIndex` が変化したとき、前セルから新セルへ `fixed` オーバーレイが CSS トランジション（`0.45s cubic-bezier`）で移動
- `data-cell-index` 属性（`TaskCell` の root div に付与）でセル DOM を特定
- アバター or 名前の頭文字を表示
- アニメーション完了（0.7秒）後にオーバーレイを非表示

---

## 4. クエストカードパネル (`TaskDetailPanel.tsx`)

### ヘッダー

- タイトル: `⚔️ クエスト詳細`
- 背景: `linear-gradient(135deg, rgba(26,29,39,0.97), rgba(30,26,58,0.97))`
- ボーダー: `#3d3566`

### ステータス表示

`QUEST_STATUS_LABELS` を使用:

| DB 値 | 表示 |
|-------|------|
| `todo` | 📋 受注待ち |
| `in_progress` | ⚔️ 挑戦中 |
| `pending_approval` | ✨ 審判待ち |
| `done` | 🏆 達成 |
| `needs_revision` | 🔄 再挑戦 |

### アクションボタン

| 状態 | ボタン |
|------|--------|
| `todo` | ⚔️ 挑戦開始！ |
| `in_progress` | ✨ クリア申請する |
| `needs_revision` | 🔄 再挑戦する |

### メッセージ変更

| 旧 | 新 |
|----|----|
| 承認待ちです。管理者の確認をお待ちください。 | ✨ クリア審判中…管理者の判定をお待ちください。 |
| ⚠️ 差し戻しコメント | 🔄 再挑戦メッセージ |
| 🎉 このマスは完了しました！ | 🏆 クエスト達成！このマスをクリアしました！ |
| 成果物・報告 | 🗝️ クリア報告・成果物 |
| サブタスク | サブクエスト |

---

## 5. ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `app/sugoroku/_lib/constants.ts` | `RANK_TIERS`, `getRank()`, `QUEST_STATUS_LABELS` を追加 |
| `app/sugoroku/dashboard/_components/LevelUpToast.tsx` | 新規作成（称号アップポップアップ） |
| `app/sugoroku/dashboard/_components/ProgressBar.tsx` | EXP ゲージ + 称号バッジ + confetti にリデザイン |
| `app/sugoroku/dashboard/_components/TaskCell.tsx` | START/GOAL/CP バッジ、完了スタンプ、`totalCells` prop 追加 |
| `app/sugoroku/dashboard/_components/SugorokuGrid.tsx` | コマホップアニメーション、`totalCells` 渡し、行コネクター刷新 |
| `app/sugoroku/dashboard/_components/TaskDetailPanel.tsx` | クエストカードスタイル（ヘッダー、ラベル、ボタン、メッセージ） |
