"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = "left",
}: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !popoverRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popRect = popoverRef.current.getBoundingClientRect();
    const top = rect.bottom + 4;
    let left: number;
    if (align === "right") {
      left = rect.right - popRect.width;
    } else {
      left = rect.left;
    }
    setPosition({ top, left });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  return (
    <div ref={triggerRef} className="relative">
      {trigger}
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            style={{ position: "fixed", top: position.top, left: position.left }}
            className={cn(
              "z-50 min-w-[200px] rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
            )}
          >
            {children}
          </div>,
          document.body
        )}
    </div>
  );
}
