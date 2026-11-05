import type { ComponentType, ReactNode, MouseEvent, CSSProperties } from "react";
declare const GlassIcons: ComponentType<{items: {icon: ReactNode; color: string; label: string; href?: string; onClick?: (event: MouseEvent) => void}[]; size?: number; gap?: number; columns?: number; labels?: string; hover?: string; theme?: string; iconColor?: string; style?: CSSProperties }>;
export default GlassIcons;
