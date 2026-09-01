import type { Metadata } from "next";
import { Outfit, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { CalculatorWrapper } from "@/components/CalculatorWrapper";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "cain | SAT Prep: Math + Reading",
  description:
    "Master the SAT with bite-sized lessons, practice questions, and a structured learning path. Track your progress and build daily streaks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable}`}>
      <body className="min-h-screen flex flex-col">
        <Providers>
          {children}
          <CalculatorWrapper />
        </Providers>
      </body>
    </html>
  );
}
