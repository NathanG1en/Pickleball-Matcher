import React from "react";

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  dashed?: boolean;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  dashed = true,
  className = "",
  children,
  ...props
}: EmptyStateProps) {
  const borderClass = dashed
    ? "border-2 border-dashed border-black bg-white/60"
    : "border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000]";

  return (
    <div
      className={`rounded-2xl p-6 sm:p-8 text-center space-y-3 ${borderClass} ${className}`}
      {...props}
    >
      {icon && <div className="flex justify-center text-3xl">{icon}</div>}
      {title && (
        <h4 className="font-display text-lg font-black uppercase text-black">
          {title}
        </h4>
      )}
      {description && (
        <p className="text-sm font-bold text-neutral-600 max-w-sm mx-auto">
          {description}
        </p>
      )}
      {children}
      {action && <div className="pt-2 flex justify-center">{action}</div>}
    </div>
  );
}
