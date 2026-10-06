import React from "react";

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const variants = {
    default: "bg-slate-800 text-slate-200 border-slate-700",
    success: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
    warning: "bg-amber-950/80 text-amber-300 border-amber-800",
    danger: "bg-rose-950/80 text-rose-300 border-rose-800",
    muted: "bg-slate-800/60 text-slate-400 border-slate-700/60",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
