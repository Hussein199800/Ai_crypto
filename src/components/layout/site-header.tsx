"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const NAV = [
  { href: "/", label: "الرئيسية" },
  { href: "/reports", label: "التقارير" },
  { href: "/charts", label: "الرسوم البيانية" },
  { href: "/watchlist", label: "المفضلة" },
  { href: "/about", label: "حول المنصة" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <header className="no-print sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-14 items-center gap-4">
        <Logo />
        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(n.href) ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
              )}
              aria-current={isActive(n.href) ? "page" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 md:ms-0">
          <ThemeToggle />
          <div className="hidden sm:block">
            <UserMenu />
          </div>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="القائمة" aria-expanded={open}>
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-t md:hidden" aria-label="التنقل على الهاتف">
          <div className="container flex flex-col gap-1 py-3">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn("rounded-md px-3 py-2 text-sm", isActive(n.href) ? "bg-accent font-medium" : "text-muted-foreground")}
              >
                {n.label}
              </Link>
            ))}
            <div className="pt-2 sm:hidden">
              <UserMenu />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
