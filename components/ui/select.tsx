
import * as React from "react";

// Simple, non-accessible stub to satisfy TS types while you build UI.
// Later, replace with Radix Select for full behavior.
export const Select = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ children, ...props }, ref) => (
    <button ref={ref} type="button" {...props}>
      {children}
    </button>
  )
);
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

export const SelectItem = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div role="option" {...props}>
    {children}
  </div>
);

export const SelectSeparator = (props: React.HTMLAttributes<HTMLHRElement>) => <hr {...props} />;

// ---- Fix: support placeholder prop ----
export const SelectValue = ({ children, placeholder }: { children?: React.ReactNode; placeholder?: string }) => (
  <span>{children ?? placeholder ?? null}</span>
);
