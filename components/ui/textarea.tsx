
// components/ui/textarea.tsx
import React from "react";
export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className, ...rest }) => (
  <textarea {...rest} className={`w-full rounded-md border px-3 py-2 ${className ?? ""}`} />
);
