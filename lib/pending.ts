/* عدّاد العمليات الجارية مع قاعدة البيانات — يغذّي شريط التقدّم العلوي */

let count = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function subscribePending(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function pendingCount() {
  return count;
}

/** يلفّ أي عملية غير متزامنة ليظهر شريط التقدّم أثناء تنفيذها */
export async function track<T>(p: Promise<T>): Promise<T> {
  count++;
  emit();
  try {
    return await p;
  } finally {
    count--;
    emit();
  }
}

/** يلفّ دوال الـ context غير المتزامنة كلها مرة واحدة */
export function tracked<T extends object>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj };
  keys.forEach((k) => {
    const fn = obj[k];
    if (typeof fn === "function") {
      (out as Record<keyof T, unknown>)[k] = (...args: unknown[]) => {
        const r = (fn as (...a: unknown[]) => unknown)(...args);
        return r instanceof Promise ? track(r) : r;
      };
    }
  });
  return out;
}
