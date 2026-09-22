"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function FlashValue({
  value,
  className,
  children,
}: {
  value: number | string;
  className?: string;
  children: React.ReactNode;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (typeof value === "number" && typeof prev.current === "number" && value !== prev.current) {
      setFlash(value > prev.current ? "up" : "down");
      const id = window.setTimeout(() => setFlash(null), 700);
      prev.current = value;
      return () => window.clearTimeout(id);
    }
    prev.current = value;
  }, [value]);

  return (
    <span
      className={cn(
        "rounded-sm px-0.5 transition-colors duration-500",
        flash === "up" && "bg-up/20",
        flash === "down" && "bg-down/20",
        className,
      )}
    >
      {children}
    </span>
  );
}
