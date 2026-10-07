import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Ads Manager",
  description: "Amazon Ads Kampagnen analysieren und verwalten",
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="de"><body>{children}</body></html>;
}
