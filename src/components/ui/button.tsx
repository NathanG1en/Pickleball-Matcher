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
    "inline-flex items-center justify-center font-black rounded-xl border-2 border-black transition-all select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[2px_2px_0px_0px_#000]";

  const variants = {
    primary:
      "bg-[#ccff00] text-black shadow-[4px_4px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]",
    secondary:
      "bg-white text-black shadow-[4px_4px_0px_0px_#000] hover:bg-neutral-50 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]",
    danger:
      "bg-[#ff6b6b] text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#ff5252] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]",
    outline:
      "bg-transparent text-black shadow-[4px_4px_0px_0px_#000] hover:bg-neutral-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_#000]",
    ghost:
      "bg-transparent text-black border-transparent shadow-none hover:bg-black/5 hover:border-black hover:shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5",
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
