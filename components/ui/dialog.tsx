
// components/ui/dialog.tsx
import React from "react";
export const Dialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, children }) => {
  // For a real dialog, integrate Radix UI or your modal implementation.
  // Temporary: always render children when open is true.
  return open ? <div role="dialog">{children}</div> : null;
};
export const DialogContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={`rounded-xl border bg-white shadow ${className ?? ""}`} />
);
export const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={className} />
);
export const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...rest }) => (
  <h2 {...rest} className={`text-lg font-semibold ${className ?? ""}`} />
);