import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-14 w-14 text-lg font-semibold",
  };

  if (score === null || score === undefined) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center rounded-full border bg-muted text-muted-foreground",
          sizeClasses[size]
        )}
      >
        —
      </div>
    );
  }

  const color =
    score >= 70
      ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800"
      : score >= 40
        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800"
        : "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-medium",
        sizeClasses[size],
        color
      )}
    >
      {score}
    </div>
  );
}
