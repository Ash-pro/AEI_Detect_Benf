"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { homePath, isStaff } from "@/lib/roles";
import { PageLoader } from "@/components/ui/page-loader";

export default function Home() {
  const { ready, center, user } = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (user && !isStaff(user.role)) router.replace(homePath(user.role));
    else if (!center) router.replace("/setup");
    else if (!user) router.replace("/login");
    else router.replace("/entry");
  }, [ready, center, user, router]);
  return <PageLoader />;
}
