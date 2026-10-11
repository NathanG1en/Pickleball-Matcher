import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  sizeVariant?: "sm" | "md";
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = "", sizeVariant = "md", hasError, disabled, ...props }, ref) => {
    const base =
      "w-full rounded-xl border-2 font-bold text-black focus:outline-none transition-shadow disabled:opacity-50 disabled:cursor-not-allowed";

    const sizeClasses = {
      sm: "px-3 py-2 text-sm shadow-[2px_2px_0px_0px_#000] focus:shadow-[4px_4px_0px_0px_#000]",
      md: "px-4 py-3 text-base shadow-[3px_3px_0px_0px_#000] focus:shadow-[5px_5px_0px_0px_#000]",
    };

    const stateClasses = hasError
      ? "border-red-600 bg-red-50 text-black placeholder-red-400 focus:border-red-600"
      : "border-black bg-white placeholder-neutral-400";

    return (
      <textarea
        ref={ref}
        disabled={disabled}
        aria-invalid={hasError ? "true" : props["aria-invalid"]}
        className={`${base} ${sizeClasses[sizeVariant]} ${stateClasses} ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";

