"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function Home() {
  const { ready, center, user, project } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else if (user.role === "PROJECT" && !project) router.replace("/select-project");
    else router.replace("/verify");
  }, [ready, center, user, project, router]);
  return <div className="min-h-dvh" />;
}
