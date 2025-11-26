
// components/ui/button.tsx
import React from "react";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "glass" | "glass-selected" | "default";
};
export const Button: React.FC<Props> = ({ variant = "default", className, ...rest }) => {
  const base = "inline-flex items-center justify-center rounded-md px-3 py-2";
  const variants = {
    default: "bg-gray-100 hover:bg-gray-200",
    glass: "bg-white/40 backdrop-blur border border-white/30 hover:bg-white/50",
    "glass-selected": "bg-blue-600 hover:bg-blue-700 text-white",
  };
  return <button {...rest} className={`${base} ${variants[variant]} ${className ?? ""}`} />;
};
