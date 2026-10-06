import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";

  const variants = {
    primary:
      "bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 focus-visible:outline-emerald-600 shadow-sm",
    secondary:
      "bg-slate-800 text-slate-100 hover:bg-slate-700 active:bg-slate-900 focus-visible:outline-slate-700",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 focus-visible:outline-rose-600",
    outline:
      "border-2 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 active:bg-slate-900 focus-visible:outline-slate-500",
    ghost:
      "bg-transparent text-slate-300 hover:bg-slate-800/60 active:bg-slate-800 focus-visible:outline-slate-500",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm min-h-[36px]",
    md: "px-4 py-2.5 text-base min-h-[44px]",
    lg: "px-6 py-3.5 text-lg min-h-[52px]",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
