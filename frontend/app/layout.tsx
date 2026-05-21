import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Deterministic single-user calorie tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

