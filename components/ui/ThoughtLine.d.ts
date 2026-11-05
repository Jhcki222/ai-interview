import type { ComponentType } from "react";
declare const ThoughtLine: ComponentType<{
  working?: boolean;
  interrupted?: boolean;
  steps?: string[];
  label?: string;
  doneLabel?: string;
  elapsed?: number;
  color?: string;
  glyphColor?: string;
  fontSize?: number;
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  showTimer?: boolean;
}>;
export default ThoughtLine;
