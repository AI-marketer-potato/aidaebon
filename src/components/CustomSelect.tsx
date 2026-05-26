"use client";

import { useEffect, useRef, useState } from "react";

type Option = string | { label: string; value: string };

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "선택하세요",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly Option[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const opts = options.map((o) =>
    typeof o === "string" ? { label: o, value: o } : o,
  );
  const selected = opts.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field flex w-full items-center justify-between gap-2 rounded-xl px-4 py-3 text-left text-sm"
      >
        <span className={selected ? "text-white" : "text-white/40"}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          className={`shrink-0 text-xs text-white/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <ul className="fade-up absolute z-50 mt-2 max-h-60 w-full min-w-max overflow-y-auto rounded-xl border border-white/10 bg-[#171430] p-1 shadow-2xl">
          {opts.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-violet-500/25 ${
                  o.value === value
                    ? "bg-violet-500/30 text-white"
                    : "text-white/70"
                }`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
