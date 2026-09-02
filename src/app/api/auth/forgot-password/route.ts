import { NextResponse } from "next/server";
import { isEmailAuthEnabled } from "@/lib/email-auth";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken, sendPasswordResetEmail } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isEmailAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    const normalized = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalized },
    });
    // Always return same message so we don't leak whether email exists
    if (!user || !user.password) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with that email, we sent a reset link.",
      });
    }
    const token = await createPasswordResetToken(normalized);
    const sent = await sendPasswordResetEmail(normalized, token);
    return NextResponse.json({
      success: true,
      message: sent
        ? "If an account exists with that email, we sent a reset link."
        : "If an account exists with that email, we sent a reset link. (Email delivery may be delayed, so check spam.)",
      ...(process.env.NODE_ENV === "development" && !sent && { resetUrl: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/auth/reset-password?token=${token}&email=${encodeURIComponent(normalized)}` }),
    });
  } catch (e) {
    console.error("Forgot password error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
