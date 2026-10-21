"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function Home() {
  const { ready, center, user } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (user?.role === "ADMIN") router.replace("/admin");
    else if (!center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else router.replace("/entry");
  }, [ready, center, user, router]);
  return <div className="min-h-dvh" />;
}
