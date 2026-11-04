"use client";

import { useRouter } from "next/navigation";
import CircularCarousel from "@/components/ui/CircularCarousel";
import { categories, questions } from "@/lib/questions";
import { useTheme } from "next-themes";

const categoryGradients: Record<
  string,
  { bg1: string; bg2: string; accent: string; iconLabel: string }
> = {
  CS: { bg1: "#f1effc", bg2: "#deddf5", accent: "#7666bd", iconLabel: "CS" },
  BACKEND: { bg1: "#f0f3fb", bg2: "#dfe7f7", accent: "#657faf", iconLabel: "BE" },
  AI: { bg1: "#f4f0fc", bg2: "#e5dcf5", accent: "#8a72b5", iconLabel: "AI" },
  PERSONALITY: { bg1: "#faf3f7", bg2: "#eedfe9", accent: "#aa819c", iconLabel: "FIT" },
  MOTIVATION: { bg1: "#faf7f1", bg2: "#eee7d9", accent: "#a38d65", iconLabel: "MOT" },
  BUSINESS: { bg1: "#f1f3fa", bg2: "#dfe3f2", accent: "#7683af", iconLabel: "BIZ" },
  PROJECTS: { bg1: "#f0f7f5", bg2: "#dfece8", accent: "#739b93", iconLabel: "PRJ" },
};

function generateCategorySvg(
  name: string,
  count: number,
  meta: { bg1: string; bg2: string; accent: string; iconLabel: string },
  dark = false,
) {
  const background1 = dark ? "#24283c" : meta.bg1;
  const background2 = dark ? "#30364e" : meta.bg2;
  const ink = dark ? "#eeeefa" : "#3c4058";
  const secondary = dark ? "#a9acc8" : "#85859e";
  const accent = dark ? "#b3a6e7" : meta.accent;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="g_${meta.iconLabel}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${background1}" />
      <stop offset="100%" stop-color="${background2}" />
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="398" height="398" rx="32" fill="url(#g_${meta.iconLabel})" stroke="${dark ? "#454c67" : "#ffffff"}" stroke-width="2" />
  <circle cx="365" cy="35" r="110" fill="none" stroke="${accent}" stroke-opacity="0.09" stroke-width="1" />
  <circle cx="365" cy="35" r="145" fill="none" stroke="${accent}" stroke-opacity="0.07" stroke-width="1" />
  <circle cx="200" cy="140" r="52" fill="${accent}" fill-opacity="0.06" />
  <circle cx="200" cy="140" r="42" fill="${dark ? "#353952" : "#ffffff"}" fill-opacity="0.8" />
  <text x="200" y="151" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="25" font-weight="700" fill="${accent}" text-anchor="middle" letter-spacing="1">${meta.iconLabel}</text>
  <text x="200" y="235" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="23" font-weight="650" fill="${ink}" text-anchor="middle">${name}</text>
  <rect x="135" y="260" width="130" height="28" rx="14" fill="${accent}" fill-opacity="0.08" />
  <text x="200" y="279" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="13" font-weight="500" fill="${accent}" text-anchor="middle">${count}개 질문</text>
  <text x="200" y="340" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="12" fill="${secondary}" text-anchor="middle">한 질문씩, 더 단단하게 →</text>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function TopicCarousel() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  const carouselItems = categories.map((cat) => {
    const count = questions.filter((q) => q.category === cat.id).length;
    const meta = categoryGradients[cat.id] || {
      bg1: "#f1effc",
      bg2: "#deddf5",
      accent: "#7666bd",
      iconLabel: "TOPIC",
    };
    return {
      src: generateCategorySvg(cat.name, count, meta, resolvedTheme === "dark"),
      alt: cat.name,
      title: cat.name,
      subtitle: `${count}개 기술 면접 질문`,
      categoryId: cat.id,
    };
  });

  return (
    <div
      className="topic-carousel-container"
      style={{ width: "100%", height: "420px", position: "relative", margin: "20px 0" }}
    >
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
        innerShade={0.08}
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
