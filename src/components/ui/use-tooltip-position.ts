"use client";

import { useLayoutEffect, useEffect, useRef, useState, useCallback } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SizeLike {
  width: number;
  height: number;
}

export interface ViewportLike {
  width: number;
  height: number;
}

const EMPTY_STYLE: React.CSSProperties = {};

/**
 * Calculates fixed viewport-clamped styles for tooltips to guarantee they remain
 * 100% on-screen across all viewports (mobile, tablet, desktop, and Chrome DevTools).
 */
export function calculateTooltipPosition(
  triggerRect: RectLike,
  tooltipRect: SizeLike,
  viewport: ViewportLike,
  margin = 12,
): React.CSSProperties {
  const width = Math.min(viewport.width - margin * 2, Math.max(tooltipRect.width || 0, 256));
  const height = tooltipRect.height || 100;

  // Horizontal position:
  let desiredLeft: number;
  if (viewport.width >= 640 && triggerRect.right + 8 + width + margin <= viewport.width) {
    // Fits comfortably to the right on desktop
    desiredLeft = triggerRect.right + 8;
  } else if (viewport.width >= 640 && triggerRect.left - 8 - width >= margin) {
    // Fits to the left on desktop when right side is constrained
    desiredLeft = triggerRect.left - 8 - width;
  } else {
    // Align with trigger left on mobile / constrained screens
    desiredLeft = triggerRect.left;
  }

  // Strictly clamp horizontally so it never exceeds screen bounds
  const maxLeft = Math.max(margin, viewport.width - width - margin);
  const clampedLeft = Math.max(margin, Math.min(desiredLeft, maxLeft));

  // Vertical position:
  let desiredTop: number;
  if (viewport.width >= 640 && (desiredLeft === triggerRect.right + 8 || desiredLeft === triggerRect.left - 8 - width)) {
    // Vertically centered relative to trigger
    const triggerCenterY = triggerRect.top + (triggerRect.bottom - triggerRect.top) / 2;
    desiredTop = triggerCenterY - height / 2;
  } else {
    // Below the trigger unless it overflows bottom and fits above
    const openAbove =
      triggerRect.bottom + height + margin > viewport.height &&
      triggerRect.top - height - margin > 0;
    desiredTop = openAbove ? triggerRect.top - height - 6 : triggerRect.bottom + 6;
  }

  // Strictly clamp vertically so it never exceeds screen bounds
  const maxTop = Math.max(margin, viewport.height - height - margin);
  const clampedTop = Math.max(margin, Math.min(desiredTop, maxTop));

  return {
    position: "fixed",
    left: `${Math.round(clampedLeft)}px`,
    top: `${Math.round(clampedTop)}px`,
    transform: "none",
    maxWidth: `calc(100vw - ${margin * 2}px)`,
    maxHeight: `calc(100vh - ${margin * 2}px)`,
    zIndex: 9999,
  };
}

/**
 * Ensures tooltips stay completely within the visible screen on mobile and desktop
 * by measuring the trigger and computing fixed coordinates clamped to the viewport.
 */
export function useTooltipPosition(isOpen: boolean, onClose?: () => void) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>(EMPTY_STYLE);

  // Keep a ref to onClose to avoid triggering re-runs when callers pass inline arrow functions
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined") return;

    const trigger = triggerRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip
      ? tooltip.getBoundingClientRect()
      : { width: 256, height: 100 };
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const nextStyle = calculateTooltipPosition(triggerRect, tooltipRect, viewport);
    setStyle((prev) => {
      if (
        prev.left === nextStyle.left &&
        prev.top === nextStyle.top &&
        prev.position === nextStyle.position &&
        prev.maxWidth === nextStyle.maxWidth
      ) {
        return prev;
      }
      return nextStyle;
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) {
      setStyle((prev) => (prev === EMPTY_STYLE || Object.keys(prev).length === 0 ? prev : EMPTY_STYLE));
      return;
    }

    updatePosition();

    // Re-check next frame in case styles or fonts changed dimensions
    const frameId = requestAnimationFrame(() => {
      updatePosition();
    });

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current?.();
      }
    };
    const handlePointerDown = (e: PointerEvent) => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      const target = e.target as Node | null;
      if (
        target &&
        trigger &&
        !trigger.contains(target) &&
        tooltip &&
        !tooltip.contains(target)
      ) {
        onCloseRef.current?.();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointerDown, { capture: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [isOpen, updatePosition]);

  return { triggerRef, tooltipRef, style, updatePosition };
}

