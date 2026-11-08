import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Intelligence Admin",
  description: "Office Intelligence operations and payment administration",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
