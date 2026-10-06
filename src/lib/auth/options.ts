import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { getEnv, isGoogleAuthEnabled } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { loginSchema } from "@/lib/validators";
import { dummyHash, verifyPassword } from "./password";

export const AUTH_ERRORS = {
  INVALID: "INVALID_CREDENTIALS",
  UNVERIFIED: "EMAIL_NOT_VERIFIED",
  RATE: "TOO_MANY_ATTEMPTS",
} as const;

function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "البريد وكلمة المرور",
      credentials: {
        email: { label: "البريد الإلكتروني", type: "email" },
        password: { label: "كلمة المرور", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new Error(AUTH_ERRORS.INVALID);
        const { email, password } = parsed.data;

        const headers = new Headers((req?.headers ?? {}) as Record<string, string>);
        const ip = clientIp(headers);
        const byIp = rateLimit(`login:ip:${ip}`, 20, 15 * 60_000);
        const byEmail = rateLimit(`login:email:${email}`, 8, 15 * 60_000);
        if (!byIp.ok || !byEmail.ok) throw new Error(AUTH_ERRORS.RATE);

        const user = await prisma.user.findUnique({ where: { email } });
        const ok = await verifyPassword(password, user?.passwordHash ?? dummyHash());
        if (!user || !user.passwordHash || !ok) throw new Error(AUTH_ERRORS.INVALID);
        if (getEnv().REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) throw new Error(AUTH_ERRORS.UNVERIFIED);
        return { id: user.id, name: user.name, email: user.email, image: user.image, role: user.role };
      },
    }),
  ];
  if (isGoogleAuthEnabled()) {
    const env = getEnv();
    providers.push(
      GoogleProvider({
        clientId: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }
  return providers;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // JWT مطلوب مع مزود البيانات المعتمدة (Credentials). ملفات تعريف الارتباط HttpOnly وSameSite=Lax وSecure في الإنتاج.
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: "/login", error: "/login" },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "USER" | "ADMIN" }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.role = token.role ?? "USER";
      }
      return session;
    },
  },
  events: {
    // حسابات Google موثقة البريد من المزود
    async linkAccount({ user }) {
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } }).catch(() => undefined);
    },
  },
};
