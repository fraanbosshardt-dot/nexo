"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function BillingRefresh({ waiting }: { waiting: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!waiting) return;
    let attempts = 0;
    const timer = setInterval(() => {
      router.refresh();
      if (++attempts >= 12) clearInterval(timer);
    }, 5000);
    return () => clearInterval(timer);
  }, [waiting, router]);
  return null;
}
