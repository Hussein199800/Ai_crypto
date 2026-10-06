"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Bell, FileText, LogIn, LogOut, Star, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

export function UserMenu() {
  const { data, status } = useSession();
  if (status === "loading") return <Skeleton className="h-9 w-24" />;
  if (!data?.user) {
    return (
      <Button asChild size="sm">
        <Link href="/login">
          <LogIn />
          تسجيل الدخول
        </Link>
      </Button>
    );
  }
  const name = data.user.name || data.user.email || "المستخدم";
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="قائمة المستخدم">
          <User />
          <span className="max-w-[8rem] truncate">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{data.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reports?mine=true">
            <FileText />
            تقاريري
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/watchlist">
            <Star />
            المفضلة
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/alerts">
            <Bell />
            التنبيهات
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/" })} className="text-negative focus:text-negative">
          <LogOut />
          تسجيل الخروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
