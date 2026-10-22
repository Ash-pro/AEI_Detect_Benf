"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/** عميل Supabase للمتصفح — الجلسة في cookies حتى تقرأها دوال الخادم */
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  }
  return client;
}

/** اسم المستخدم ← البريد الداخلي في Supabase Auth */
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@aei.local`;
