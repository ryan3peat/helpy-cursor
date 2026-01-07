"use client";

export const Footer = () => {
  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Helpy. All rights reserved.</p>
      </div>
    </footer>
  );
};
