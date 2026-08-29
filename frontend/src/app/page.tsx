"use client";

import { useRouter } from "next/navigation";
import { PremiumLanding } from "./premium-landing";

export default function HomePage() {
  const router = useRouter();
  return (
    <PremiumLanding
      onStart={(view?: string) =>
        router.push(view ? `/workspace?view=${encodeURIComponent(view)}` : "/workspace")
      }
    />
  );
}
