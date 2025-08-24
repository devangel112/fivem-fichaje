"use client";
import { useEffect, useState } from "react";

export function ClientTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string>(iso);
  useEffect(() => {
    try {
      setText(new Date(iso).toLocaleString());
    } catch {
      setText(iso);
    }
  }, [iso]);
  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>{text}</time>
  );
}
