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
    default: "bg-white text-black border-2 border-black",
    success: "bg-[#ccff00] text-black border-2 border-black",
    warning: "bg-[#fde047] text-black border-2 border-black",
    danger: "bg-[#ff6b6b] text-black border-2 border-black",
    muted: "bg-neutral-200 text-neutral-900 border-2 border-black",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
