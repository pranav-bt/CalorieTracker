import type { Metadata, Viewport } from "next";
import { AppShell } from "./components/AppShell";
import { DbProvider } from "./db/DbProvider";
import "./styles.css";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Deterministic single-user calorie tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <DbProvider>
          <AppShell>{children}</AppShell>
        </DbProvider>
      </body>
    </html>
  );
}
