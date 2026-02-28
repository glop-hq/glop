"use client";

import { useState, useCallback } from "react";
import { ArrowUp, ArrowDown, Filter, X } from "lucide-react";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc" | null;

export function ColumnHeader({
  label,
  sortDir,
  onSort,
  filterValues,
  selectedFilters,
  onFilterChange,
  align,
}: {
  label: string;
  sortDir?: SortDir;
  onSort?: (dir: SortDir) => void;
  filterValues?: string[];
  selectedFilters?: Set<string>;
  onFilterChange?: (values: Set<string>) => void;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const hasActiveFilter = selectedFilters && selectedFilters.size > 0;
  const sortable = !!onSort;
  const filterable = !!filterValues && filterValues.length > 0;

  const handleSort = useCallback(
    (dir: SortDir) => {
      onSort?.(dir);
      if (!filterable) setOpen(false);
    },
    [onSort, filterable]
  );

  const toggleFilter = useCallback(
    (value: string) => {
      if (!selectedFilters || !onFilterChange) return;
      const next = new Set(selectedFilters);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      onFilterChange(next);
    },
    [selectedFilters, onFilterChange]
  );

  const clearFilters = useCallback(() => {
    onFilterChange?.(new Set());
  }, [onFilterChange]);

  if (!sortable && !filterable) {
    return (
      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </th>
    );
  }

  return (
    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        align={align}
        trigger={
          <button
            onClick={() => setOpen(!open)}
            className={cn(
              "inline-flex items-center gap-1 hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded cursor-pointer",
              hasActiveFilter && "text-foreground bg-accent"
            )}
          >
            {label}
            {sortDir === "asc" && <ArrowUp className="h-3 w-3" />}
            {sortDir === "desc" && <ArrowDown className="h-3 w-3" />}
            {!sortDir && hasActiveFilter && (
              <Filter className="h-3 w-3" />
            )}
          </button>
        }
      >
        <div className="min-w-[180px]">
          {/* Sort options */}
          {sortable && (
            <div className={filterable ? "pb-1 mb-1 border-b" : ""}>
              <button
                onClick={() => handleSort(sortDir === "asc" ? null : "asc")}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors cursor-pointer",
                  sortDir === "asc" && "bg-accent font-medium"
                )}
              >
                <ArrowUp className="h-3 w-3" />
                Sort ascending
              </button>
              <button
                onClick={() => handleSort(sortDir === "desc" ? null : "desc")}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors cursor-pointer",
                  sortDir === "desc" && "bg-accent font-medium"
                )}
              >
                <ArrowDown className="h-3 w-3" />
                Sort descending
              </button>
            </div>
          )}

          {/* Filter options */}
          {filterable && (
            <div>
              <div className="max-h-[200px] overflow-y-auto">
                {filterValues!.map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFilters?.has(value) ?? false}
                      onChange={() => toggleFilter(value)}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <span className="truncate">{value}</span>
                  </label>
                ))}
              </div>
              {hasActiveFilter && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground border-t mt-1 pt-1.5 transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      </Popover>
    </th>
  );
}
