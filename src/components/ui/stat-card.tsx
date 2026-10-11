import React from "react";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  variant?: "default" | "accent" | "highlight";
}

export function StatCard({
  label,
  value,
  subtext,
  variant = "default",
  className = "",
  ...props
}: StatCardProps) {
  const variants = {
    default: "bg-white text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    accent: "bg-[#ccff00] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    highlight: "bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
  };

  return (
    <div
      className={`rounded-2xl p-3 sm:p-4 text-center transition-all ${variants[variant]} ${className}`}
      {...props}
    >
      <p className="font-display text-2xl sm:text-3xl font-black">{value}</p>
      <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-neutral-700 mt-0.5">
        {label}
      </p>
      {subtext && (
        <p className="text-[10px] font-bold text-neutral-600 mt-1">
          {subtext}
        </p>
      )}
    </div>
  );
}

