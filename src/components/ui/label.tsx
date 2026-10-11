import React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({
  children,
  className = "",
  required,
  ...props
}: LabelProps) {
  return (
    <label
      className={`block text-xs font-black uppercase tracking-wider text-black mb-1.5 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="ml-1 text-red-600" aria-hidden="true">*</span>}
    </label>
  );
}

