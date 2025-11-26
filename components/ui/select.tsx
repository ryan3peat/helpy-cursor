
// components/ui/select.tsx
import React from "react";

// Temporary simple Select (you can replace with Radix Select):
export const Select: React.FC<{
  value: string;
  onValueChange: (v: string) => void;
  children: React.ReactNode;
}> = ({ value, onValueChange, children }) => (
  <div data-role="select">{children}</div>
);

// Helpers used by your dialog:
export const SelectTrigger: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({ className, ...rest }) => (
  <button {...rest} className={`rounded-md border px-3 py-2 ${className ?? ""}`} />
);
export const SelectContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={`rounded-md border bg-white shadow ${className ?? ""}`} />
);
export const SelectItem: React.FC<{ value: string } & React.HTMLAttributes<HTMLDivElement>> = ({ value, className, ...rest }) => (
  <div {...rest} data-value={value} className={`cursor-pointer px-3 py-2 hover:bg-gray-100 ${className ?? ""}`} />
);
export const SelectSeparator: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...rest }) => (
  <div {...rest} className={`my-1 border-t ${className ?? ""}`} />
);
export const SelectValue: React.FC = () => <span />;
