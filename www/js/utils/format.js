// js/utils/format.js — 显示格式化（金额/日期/时长/评分/座位）
// 规则见作业文档第 9 节。所有日期展示都用「影院时区」timeZone（来自 /api/config），
// 但倒计时、截止时间对比用本机当前时间（在页面里用 Date.now() 算，不走这里）。

// 金额：1550 → "1 550 ₽"；折扣 −350 → "−350 ₽"
export function formatMoney(amount) {
  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  return `${sign}${new Intl.NumberFormat('ru-RU').format(abs)} ₽`;
}

// 时长：127 → "2 h 7 min"
export function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${m} min`;
}

// 评分：8.2 → "8.20"（保留两位小数）
export function formatRating(value) {
  return Number(value).toFixed(2);
}

// 场次日期时间："Mon, 5 Oct · 19:30"（影院时区）
export function formatSessionDateTime(iso, timeZone) {
  const d = new Date(iso);
  const datePart = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone,
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(d);
  return `${datePart} · ${timePart}`;
}

// 时间段："19:30‑21:37"
export function formatTimeRange(startIso, endIso, timeZone) {
  const fmt = (iso) => new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone,
  }).format(new Date(iso));
  return `${fmt(startIso)}‑${fmt(endIso)}`;
}

// 倒计时：3750 秒 → "62:30"
export function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 座位："Row 10, Seat 9"
export function formatSeat(row, number) {
  return `Row ${row}, Seat ${number}`;
}
