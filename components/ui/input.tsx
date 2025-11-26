
// components/ui/input.tsx
import React from "react";
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...rest }) => (
  <input {...rest} className={`w-full rounded-md border px-3 py-2 ${className ?? ""}`} />
);
