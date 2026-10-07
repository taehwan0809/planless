import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PLANLESS",
  description: "여행 중 계획이 틀어졌을 때 새로운 일정을 만들어주는 AI 여행 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
