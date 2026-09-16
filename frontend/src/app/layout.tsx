import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const landingSans = Plus_Jakarta_Sans({
  variable: "--font-landing-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const landingSerif = Source_Serif_4({
  variable: "--font-landing-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "MediGuide — Health Document Intelligence",
  description:
    "Health document intelligence that converts uploaded lab reports into structured, traceable timelines and understandable educational explanations while preserving source evidence.",
  applicationName: "MediGuide",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${landingSans.variable} ${landingSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
