import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TZ = "Asia/Gaza";

/** تحويل الأرقام العربية/الهندية إلى إنجليزية وحذف أي رمز غير رقمي */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "");
}

/** خانة الضبط لرقم الهوية (Luhn معدّل على 9 أرقام) */
export function isValidNationalId(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;
  let total = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(id[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    total += d;
  }
  return total % 10 === 0;
}

export function normalizeArabicName(value: string): string {
  return value
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameParts(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizePhone(value: string): string {
  let d = normalizeDigits(value);
  if (d.startsWith("970") || d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}

export function isValidPhone(value: string): boolean {
  return /^05[69]\d{7}$/.test(normalizePhone(value));
}

export function dateKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function isToday(iso: string): boolean {
  return dateKey(iso) === todayKey();
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

export function daysBetween(iso: string): number {
  const a = new Date(dateKey(iso) + "T00:00:00Z").getTime();
  const b = new Date(todayKey() + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "منذ 7 أيام" / "منذ شهر" مع قواعد العدد العربية */
export function sinceText(iso: string): string {
  const n = daysBetween(iso);
  if (n <= 0) return "اليوم";
  if (n === 1) return "أمس";
  if (n === 2) return "منذ يومين";
  if (n <= 10) return `منذ ${n} أيام`;
  if (n < 30) return `منذ ${n} يوماً`;
  if (n < 365) {
    const m = Math.floor(n / 30);
    if (m === 1) return "منذ شهر";
    if (m === 2) return "منذ شهرين";
    return `منذ ${m} أشهر`;
  }
  const y = Math.floor(n / 365);
  if (y === 1) return "منذ سنة";
  if (y === 2) return "منذ سنتين";
  return y <= 10 ? `منذ ${y} سنوات` : `منذ ${y} سنة`;
}

/** "منذ 18 دقيقة" لمدة الانتظار */
export function minutesText(n: number): string {
  if (n < 1) return "أقل من دقيقة";
  if (n === 1) return "دقيقة";
  if (n === 2) return "دقيقتان";
  if (n <= 10) return `${n} دقائق`;
  if (n < 60) return `${n} دقيقة`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`}${m ? ` و${m} د` : ""}`;
}

export function countText(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 0) return `لا ${few}`;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function storageSet(key: string, value: unknown) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* تجاهل */
  }
}

/* ===== تواريخ بصيغة YYYY-MM-DD ===== */

export function addDays(key: string, n: number): string {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export function weekday(key: string): string {
  return WEEKDAYS[new Date(key + "T12:00:00Z").getUTCDay()];
}

export function dayNum(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

export function dayFull(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

/** "الثلاثاء 21/10" */
export function dayLabel(key: string): string {
  return `${weekday(key)} ${dayNum(key)}`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

/** "أكتوبر 2026" */
export function monthLabel(mk: string): string {
  const [y, m] = mk.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "حالة" مع قواعد العدد العربية */
export function casesText(n: number): string {
  if (n === 0) return "لا حالات";
  if (n === 1) return "حالة واحدة";
  if (n === 2) return "حالتان";
  if (n <= 10) return `${n} حالات`;
  return `${n} حالة`;
}
