import type { CSSProperties, ReactNode } from "react";

export interface CarouselItem {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  [key: string]: any;
}

export interface CircularCarouselProps {
  items?: CarouselItem[];
  preset?: string;
  intro?: string;
  cardWidth?: number;
  aspectRatio?: number;
  gap?: number;
  curve?: number;
  tilt?: number;
  perspective?: number;
  autoplay?: string;
  speed?: number;
  interval?: number;
  direction?: "left" | "right";
  draggable?: boolean;
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  parallax?: number;
  stretch?: number;
  depthFade?: number;
  fadeColor?: string;
  innerShade?: number;
  cornerRadius?: number;
  captions?: boolean;
  onChange?: (index: number) => void;
  onItemClick?: (item: any, index: number) => void;
  style?: CSSProperties;
  className?: string;
}

declare const CircularCarousel: (props: CircularCarouselProps) => ReactNode;
export default CircularCarousel;
