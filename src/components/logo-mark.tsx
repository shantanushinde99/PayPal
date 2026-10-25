import { useId } from "react";
import { MARK_GRADIENT, MARK_PATH } from "@/lib/brand";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  const id = useId(); // several logos on one page need their own gradient id
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {MARK_GRADIENT.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d={MARK_PATH} fill="none" stroke="#fff" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="50" cy="15" r="4.2" fill="#fde68a" />
    </svg>
  );
}
