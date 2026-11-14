import React from "react";
import { CheckIcon, XIcon } from "@/components/ui/icons";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  fixed?: boolean;
  className?: string;
  testId?: string;
  /** Toast auto-dismiss duration in milliseconds. Renders a loader bar along the bottom when > 0. Set to 0 to disable. Defaults to 3000. */
  duration?: number;
}

export function Toast({
  children,
  onDismiss,
  icon,
  fixed = true,
  className = "",
  testId,
  role = "status",
  duration = 3000,
  ...props
}: ToastProps) {
  const positionClass = fixed
    ? "fixed bottom-4 left-4 right-4 sm:bottom-auto sm:left-auto sm:top-4 sm:right-4 z-[60] max-w-[calc(100vw-2rem)] sm:max-w-md"
    : "w-fit max-w-full";

  return (
    <div
      data-testid={testId}
      className={`${positionClass} relative overflow-hidden flex items-center justify-between gap-3 bg-[#ccff00] border-2 border-black rounded-xl p-2.5 sm:p-3 pb-3 sm:pb-3.5 font-black text-black shadow-[3px_3px_0px_0px_#000] text-sm animate-in fade-in ${className}`}
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
          className="ml-auto inline-flex min-h-[32px] min-w-[32px] items-center justify-center p-0.5 text-black hover:opacity-70 transition-opacity cursor-pointer shrink-0 border-0 bg-transparent shadow-none outline-none"
        >
          <XIcon className="h-3.5 w-3.5 stroke-[2.5]" />
        </button>
      )}
      {duration > 0 && (
        <div
          data-testid="toast-progress-track"
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 h-1 bg-black/15 overflow-hidden"
        >
          <div
            data-testid="toast-progress-bar"
            className="toast-progress-bar h-full bg-black"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  );
}

