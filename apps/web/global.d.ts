declare module "*.css";

declare module "d3" {
  export function scaleTime(): {
    domain(values: [Date, Date]): {
      range(values: [number, number]): (value: Date) => number;
    };
  };
}

declare module "react-grid-layout" {
  import type { ComponentType, ReactNode } from "react";

  export type LayoutItem = {
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  };

  export type Layout = LayoutItem[];

  const GridLayout: ComponentType<{
    className?: string;
    layout: Layout;
    cols: number;
    rowHeight: number;
    width: number;
    onLayoutChange?: (layout: Layout) => void;
    children?: ReactNode;
  }>;

  export default GridLayout;
}

declare global {
  interface Window {
    __amdoxForceOffline?: boolean;
  }
}
