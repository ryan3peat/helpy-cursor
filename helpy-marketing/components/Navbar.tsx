"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export const Navbar = () => {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/home", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/getapp", label: "Get the App" },
    { href: "/faq", label: "FAQ" }
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/helpy-logo-text.png"
            alt="helpy"
            width={80}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1 transition ${
                  isActive
                    ? "bg-primary text-white"
                    : "hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition sm:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-border bg-background/95 backdrop-blur">
          <div className="flex flex-col px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
};


