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
  title: "MediGuide AI | Clearer health conversations",
  description: "A private, evidence-aware health education workspace.",
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
