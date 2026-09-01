import { NextResponse } from "next/server";
import { isEmailAuthEnabled } from "@/lib/email-auth";
import { prisma } from "@/lib/prisma";
import { verifyPasswordResetToken, hashPassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isEmailAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { email, token, password } = await request.json();
    if (!email || !token || !password) {
      return NextResponse.json(
        { error: "Email, token, and new password are required" },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const normalized = email.trim().toLowerCase();
    const valid = await verifyPasswordResetToken(normalized, token);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }
    const hashed = await hashPassword(password);
    await prisma.user.update({
      where: { email: normalized },
      data: { password: hashed },
    });
    return NextResponse.json({
      success: true,
      message: "Password updated. You can log in with your new password.",
    });
  } catch (e) {
    console.error("Reset password error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
