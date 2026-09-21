"use client";

import { useRouter } from "next/navigation";
import { PremiumLanding } from "./premium-landing";
import { VIEW_TO_PATH, type View } from "./workspace/_state/workspace-shared";

export default function HomePage() {
  const router = useRouter();
  return (
    <PremiumLanding
      onStart={(view?: string, action?: string) => {
        const path = (view && VIEW_TO_PATH[view as View]) || "home";
        const query = action ? `?action=${encodeURIComponent(action)}` : "";
        router.push(`/workspace/${path}${query}`);
      }}
    />
  );
}
