import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/states";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="الصفحة غير موجودة"
      description="ربما تم نقل الصفحة أو أن الرابط غير صحيح."
      action={
        <Button asChild>
          <Link href="/">العودة إلى الرئيسية</Link>
        </Button>
      }
      className="mt-10"
    />
  );
}
