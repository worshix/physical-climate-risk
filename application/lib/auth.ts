import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export type Session = {
  userId: string;
  role: "ADMIN" | "BORROWER";
};

/**
 * Returns the current session from cookies, or null if not authenticated.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get("userId")?.value;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) return null;

  return { userId: user.id, role: user.role as "ADMIN" | "BORROWER" };
}

/**
 * Returns the session if the user is an ADMIN, otherwise returns null.
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return null;
  return session;
}

/**
 * Returns the session if the user is a BORROWER, otherwise returns null.
 */
export async function getBorrowerSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== "BORROWER") return null;
  return session;
}
