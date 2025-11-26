
// components/ui/label.tsx
import React from "react";
export const Label: React.FC<React.LabelHTMLAttributes<HTMLLabelElement>> = ({ className, ...rest }) => (
  <label {...rest} className={`text-sm font-medium ${className ?? ""}`} />
);
