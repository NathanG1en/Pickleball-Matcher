import React from "react";
import { CheckIcon, XIcon } from "@/components/ui/icons";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  fixed?: boolean;
  className?: string;
  testId?: string;
}

export function Toast({
  children,
  onDismiss,
  icon,
  fixed = true,
  className = "",
  testId,
  role = "status",
  ...props
}: ToastProps) {
  const positionClass = fixed
    ? "fixed top-4 right-4 z-[60] max-w-[calc(100vw-2rem)]"
    : "w-fit max-w-full";

  return (
    <div
      data-testid={testId}
      className={`${positionClass} flex items-center justify-between gap-3 bg-[#ccff00] border-2 border-black rounded-xl p-3 font-black text-black shadow-[3px_3px_0px_0px_#000] text-sm animate-in fade-in ${className}`}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon !== undefined ? icon : <CheckIcon className="h-4 w-4 shrink-0 stroke-[3]" />}
        <p role={role} className="leading-snug m-0 p-0">
          {children}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto inline-flex items-center justify-center p-0.5 text-black hover:opacity-70 transition-opacity cursor-pointer shrink-0 border-0 bg-transparent shadow-none outline-none"
        >
          <XIcon className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}

