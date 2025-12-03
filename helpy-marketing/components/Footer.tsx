"use client";

import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="mt-10 border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Helpy. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link
            href="#"
            className="hover:text-foreground"
            aria-label="Privacy"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
};
