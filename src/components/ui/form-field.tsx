import React from "react";
import { Label } from "./label";

export interface FormFieldProps {
  id?: string;
  label: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  id,
  label,
  required,
  hint,
  error,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-xs font-bold text-red-700"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          id={id ? `${id}-hint` : undefined}
          className="text-xs font-semibold text-neutral-600"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

