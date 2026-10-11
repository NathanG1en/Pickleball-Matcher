import React from "react";

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "danger" | "danger-soft" | "warning" | "success" | "info" | "muted";
  size?: "sm" | "md";
  title?: React.ReactNode;
  onClose?: () => void;
}

export function Alert({
  variant = "danger",
  size = "md",
  title,
  className = "",
  children,
  onClose,
  ...props
}: AlertProps) {
  const variants = {
    danger: "bg-[#ff6b6b] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    "danger-soft": "bg-red-50 text-red-700 border-2 border-red-600",
    warning: "bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    success: "bg-[#ccff00] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    info: "bg-[#e0f2fe] text-black border-2 border-black shadow-[3px_3px_0px_0px_#000]",
    muted: "bg-neutral-100 text-neutral-900 border-2 border-black shadow-[2px_2px_0px_0px_#000]",
  };

  const sizes = {
    sm: "p-2.5 rounded-lg text-xs font-black",
    md: "p-3 sm:p-4 rounded-xl text-sm font-black",
  };

  return (
    <div
      role="alert"
      className={`relative ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {title && <h4 className="font-display uppercase tracking-wide mb-1 text-base">{title}</h4>}
          <div>{children}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss alert"
            className="shrink-0 -mr-1 -mt-1 p-1 rounded-md hover:bg-black/10 active:bg-black/20 text-current font-bold"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
