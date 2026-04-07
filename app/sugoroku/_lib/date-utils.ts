const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

/** YYYY-MM-DD 形式の JST 日付文字列を返す（ローカル Date を JST に変換） */
function toJSTDateStr(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

/** UTC タイムスタンプ文字列を JST の "YYYY-MM-DD" に変換 */
export function toJSTDate(utcStr: string): string {
  return toJSTDateStr(new Date(utcStr));
}

/** UTC タイムスタンプ文字列を JST の "HH:MM" に変換（24時間表記） */
export function toJSTTime(utcStr: string): string {
  // Supabase の created_at は "+00:00" 付き ISO 文字列だが、
  // スペース区切りや末尾なしの場合も UTC として確実にパースするよう正規化する
  const normalized = utcStr.trim().replace(" ", "T");
  const withZ =
    normalized.endsWith("Z") || /[+\-]\d{2}:\d{2}$/.test(normalized)
      ? normalized
      : normalized + "Z";
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).formatToParts(new Date(withZ));
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** JST で「今週の月曜日」の YYYY-MM-DD を返す */
export function getCurrentWeekStart(): string {
  const jst = toJSTDateStr(new Date());
  const [y, m, d] = jst.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=日〜6=土
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(y, m - 1, d + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD に days 日加算した YYYY-MM-DD を返す（JST 純粋演算） */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const result = new Date(y, m - 1, d + days);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

/** YYYY-MM-DD に delta 週加算した YYYY-MM-DD を返す（JST 純粋演算） */
export function addWeeks(dateStr: string, delta: number): string {
  return addDays(dateStr, delta * 7);
}

/** "2025/04/07(月) 〜 2025/04/13(日)" 形式のラベルを返す */
export function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}(${DAYS_JA[date.getDay()]})`;
  };
  return `${fmt(weekStart)} 〜 ${fmt(weekEnd)}`;
}

/** "4月7日（月）" 形式のラベルを返す */
export function formatDayLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Number(dateStr.split("-")[0]), m - 1, d);
  return `${m}月${d}日（${DAYS_JA[date.getDay()]}）`;
}
