"use client";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Cpu, Code2, Server, BrainCircuit, Users, Target, Building2, Layers } from "lucide-react";
import GlassIcons from "@/components/GlassIcons";
import { categories, questions } from "@/lib/questions";
const categoryGradients: Record<
  string,
  { bg1: string; bg2: string; accent: string; iconLabel: string }
> = {
  CS: { bg1: "#f1effc", bg2: "#deddf5", accent: "#7666bd", iconLabel: "CS" },
  FRONTEND: { bg1: "#eef6f5", bg2: "#dcecea", accent: "#5c9990", iconLabel: "FE" },
  BACKEND: { bg1: "#f0f3fb", bg2: "#dfe7f7", accent: "#657faf", iconLabel: "BE" },
  AI: { bg1: "#f4f0fc", bg2: "#e5dcf5", accent: "#8a72b5", iconLabel: "AI" },
  PERSONALITY: { bg1: "#faf3f7", bg2: "#eedfe9", accent: "#aa819c", iconLabel: "FIT" },
  MOTIVATION: { bg1: "#faf7f1", bg2: "#eee7d9", accent: "#a38d65", iconLabel: "MOT" },
  BUSINESS: { bg1: "#f1f3fa", bg2: "#dfe3f2", accent: "#7683af", iconLabel: "BIZ" },
  PROJECTS: { bg1: "#f0f7f5", bg2: "#dfece8", accent: "#739b93", iconLabel: "PRJ" },
};

const icons = {
  CS: Cpu,
  FRONTEND: Code2,
  BACKEND: Server,
  AI: BrainCircuit,
  PERSONALITY: Users,
  MOTIVATION: Target,
  BUSINESS: Building2,
  PROJECTS: Layers,
};
export function TopicCarousel() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const items = categories.map((category) => {
    const meta = categoryGradients[category.id];
    const Icon = icons[category.id];
    const count = questions.filter((question) => question.category === category.id).length;
    return {
      icon: <Icon aria-hidden="true" />,
      color: `linear-gradient(135deg, ${meta.bg2}, ${meta.accent})`,
      label: `${category.name} · ${count}`,
      href: `/questions?category=${category.id}`,
      onClick: (event: React.MouseEvent) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          router.push(`/questions?category=${category.id}`);
        }
      },
    };
  });
  return (
    <div className="topic-glass-grid">
      <GlassIcons
        items={items}
        size={84}
        gap={60}
        columns={4}
        labels="always"
        hover="lift"
        theme={mounted && resolvedTheme === "dark" ? "dark" : "light"}
        iconColor={mounted && resolvedTheme === "dark" ? "#f0edff" : "#454159"}
      />
    </div>
  );
}
