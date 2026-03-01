"use client";

import { useEffect, useState } from "react";

function formatRelative(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RelativeTime({ date, prefix }: { date: string; prefix?: string }) {
  const [text, setText] = useState(() => formatRelative(date));

  useEffect(() => {
    setText(formatRelative(date));
    const interval = setInterval(() => {
      setText(formatRelative(date));
    }, 10000);
    return () => clearInterval(interval);
  }, [date]);

  return (
    <time dateTime={date} title={new Date(date).toLocaleString()}>
      {prefix ? `${prefix} ${text}` : text}
    </time>
  );
}
