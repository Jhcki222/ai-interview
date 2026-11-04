import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "interview.ai — 기술 면접, 질문부터 실전까지", template: "%s | interview.ai" },
  description:
    "CS 기초부터 AI 엔지니어링까지. 체계적인 질문 학습과 이력서 기반 AI 모의면접으로 다음 기회를 준비하세요.",
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
