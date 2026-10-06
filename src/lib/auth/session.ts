import { getServerSession } from "next-auth";
import { authOptions } from "./options";
import type { Viewer } from "./policy";

/** المستخدم الحالي من الجلسة (على الخادم) أو null */
export async function getViewer(): Promise<Viewer | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    return { id: session.user.id, role: session.user.role ?? "USER" };
  } catch {
    return null;
  }
}
