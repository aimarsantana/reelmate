"use client";

import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n";

function Star({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) {
  const id = `g${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={fill === 1 ? "100%" : fill === 0.5 ? "50%" : "0%"} stopColor="var(--accent)" />
          <stop offset={fill === 1 ? "100%" : fill === 0.5 ? "50%" : "0%"} stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"
        fill={`url(#${id})`}
        stroke="var(--accent)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Half-star rating (0.5 – 5). Each star has two tap zones: left half and right half. */
export function StarRating({ value, onChange, size = 44 }: { value?: number; onChange: (v: number) => void; size?: number }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div role="radiogroup" aria-label="Rating" className="flex justify-center" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = shown >= n ? 1 : shown >= n - 0.5 ? 0.5 : 0;
        return (
          <div key={n} className="relative" style={{ width: size, height: size }}>
            <Star fill={fill} size={size} />
            {[n - 0.5, n].map((v, i) => (
              <button
                key={v}
                role="radio"
                aria-checked={value === v}
                aria-label={t.qStars(v)}
                onClick={() => onChange(v)}
                onMouseEnter={() => setHover(v)}
                onFocus={() => setHover(v)}
                onBlur={() => setHover(null)}
                className="absolute top-0 h-full w-1/2 cursor-pointer"
                style={{ left: i === 0 ? 0 : "50%" }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function StaticStars({ value }: { value: number }) {
  return (
    <span className="whitespace-nowrap text-accent" aria-label={`${value}/5`}>
      {"★".repeat(Math.floor(value))}
      {value % 1 ? "½" : ""}
    </span>
  );
}
