import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Attendi Control Panel",
  description: "Private backoffice for Attendi platform operations"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-[var(--font-sans)] text-text antialiased">{children}</body>
    </html>
  );
}
