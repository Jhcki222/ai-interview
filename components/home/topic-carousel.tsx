"use client";

import { useRouter } from "next/navigation";
import CircularCarousel from "@/components/ui/CircularCarousel";
import { categories, questions } from "@/lib/questions";

const categoryGradients: Record<string, { bg1: string; bg2: string; accent: string; iconLabel: string }> = {
  CS: { bg1: "#1e1b4b", bg2: "#312e81", accent: "#818cf8", iconLabel: "CS" },
  BACKEND: { bg1: "#064e3b", bg2: "#047857", accent: "#34d399", iconLabel: "BE" },
  AI: { bg1: "#4c0519", bg2: "#881337", accent: "#fb7185", iconLabel: "AI" },
  PERSONALITY: { bg1: "#451a03", bg2: "#78350f", accent: "#fbbf24", iconLabel: "FIT" },
  MOTIVATION: { bg1: "#172554", bg2: "#1e40af", accent: "#60a5fa", iconLabel: "MOT" },
  BUSINESS: { bg1: "#3b0764", bg2: "#581c87", accent: "#c084fc", iconLabel: "BIZ" },
  PROJECTS: { bg1: "#134e4a", bg2: "#0f766e", accent: "#2dd4bf", iconLabel: "PRJ" },
};

function generateCategorySvg(name: string, count: number, meta: { bg1: string; bg2: string; accent: string; iconLabel: string }) {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="g_${meta.iconLabel}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${meta.bg1}" />
      <stop offset="100%" stop-color="${meta.bg2}" />
    </linearGradient>
  </defs>
  <rect width="400" height="400" rx="32" fill="url(#g_${meta.iconLabel})" />
  <circle cx="200" cy="140" r="52" fill="${meta.accent}" fill-opacity="0.22" />
  <circle cx="200" cy="140" r="42" fill="${meta.accent}" fill-opacity="0.28" />
  <text x="200" y="152" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="28" font-weight="800" fill="${meta.accent}" text-anchor="middle" letter-spacing="1">${meta.iconLabel}</text>
  <text x="200" y="235" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${name}</text>
  <rect x="135" y="260" width="130" height="28" rx="14" fill="#ffffff" fill-opacity="0.14" />
  <text x="200" y="279" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="600" fill="${meta.accent}" text-anchor="middle">${count}개 질문</text>
  <text x="200" y="340" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" fill="#ffffff" fill-opacity="0.6" text-anchor="middle">클릭하여 학습 시작 →</text>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TopicCarousel() {
  const router = useRouter();

  const carouselItems = categories.map((cat) => {
    const count = questions.filter((q) => q.category === cat.id).length;
    const meta = categoryGradients[cat.id] || {
      bg1: "#1e1b4b",
      bg2: "#312e81",
      accent: "#818cf8",
      iconLabel: "TOPIC",
    };
    return {
      src: generateCategorySvg(cat.name, count, meta),
      alt: cat.name,
      title: cat.name,
      subtitle: `${count}개 기술 면접 질문`,
      categoryId: cat.id,
    };
  });

  return (
    <div className="topic-carousel-container" style={{ width: "100%", height: "420px", position: "relative", margin: "20px 0" }}>
      <CircularCarousel
        items={carouselItems}
        preset="cylinder"
        cardWidth={240}
        aspectRatio={1}
        gap={30}
        autoplay="drift"
        speed={12}
        draggable={true}
        focusOnClick={true}
        captions={true}
        cornerRadius={24}
        fadeColor="transparent"
        onItemClick={(item: any) => {
          if (item?.categoryId) {
            router.push(`/questions?category=${item.categoryId}`);
          }
        }}
      />
    </div>
  );
}
