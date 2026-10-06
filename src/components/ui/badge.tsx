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
    default: "bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]",
    success: "bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]",
    warning: "bg-[#fde047] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]",
    danger: "bg-[#ff6b6b] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]",
    muted: "bg-neutral-200 text-neutral-900 border-2 border-black shadow-[2px_2px_0px_0px_#000]",
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
