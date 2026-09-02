import { NextResponse } from "next/server";
import { isEmailAuthEnabled } from "@/lib/email-auth";
import { prisma } from "@/lib/prisma";
import { verifyEmailToken } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isEmailAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and token are required" },
        { status: 400 }
      );
    }

    const valid = await verifyEmailToken(email, token);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { email: email.trim().toLowerCase() },
      data: { emailVerified: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Verify email error:", e);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
