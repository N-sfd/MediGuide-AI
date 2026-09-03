"use client";

import { useRouter } from "next/navigation";
import { PremiumLanding } from "./premium-landing";

export default function HomePage() {
  const router = useRouter();
  return (
    <PremiumLanding
      onStart={(view?: string, action?: string) => {
        const params = new URLSearchParams();
        if (view) params.set("view", view);
        if (action) params.set("action", action);
        router.push(params.size ? `/workspace?${params.toString()}` : "/workspace");
      }}
    />
  );
}
