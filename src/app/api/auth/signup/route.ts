import { NextResponse } from "next/server";
import { isEmailAuthEnabled } from "@/lib/email-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, createVerificationToken, sendVerificationEmail } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isEmailAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // If the account is already verified, block duplicate signups.
      if (existing.emailVerified) {
        return NextResponse.json(
          { error: "An account with this email is already verified. Please log in instead." },
          { status: 400 }
        );
      }

      // If the account exists but is not verified, just resend verification instead of blocking.
      const token = await createVerificationToken(existing.email);
      const sent = await sendVerificationEmail(existing.email, token);

      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(existing.email)}`;

      return NextResponse.json({
        success: true,
        message: sent
          ? "You already started signing up. Check your email to verify your account."
          : "You already started signing up. Verification email could not be sent. Check the console for the link in dev.",
        // Never hand the verification token back to the caller in production;
        // that alone is enough to self-verify an account.
        verifyUrl:
          process.env.NODE_ENV === "development" && !sent ? verifyUrl : undefined,
      });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name?.trim() || null,
        password: hashed,
        emailVerified: null,
      },
    });

    const token = await createVerificationToken(user.email);
    const sent = await sendVerificationEmail(user.email, token);

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/auth/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`;

    return NextResponse.json({
      success: true,
      message: sent
        ? "Account created. Check your email to verify."
        : "Account created. Verification email could not be sent. Check the console for the link in dev.",
      verifyUrl: !sent ? verifyUrl : undefined,
    });
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
