import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { calculateTooltipPosition, useTooltipPosition } from "@/components/ui/use-tooltip-position";
import { SynergyExplainerButton } from "@/components/players/synergy-explainer";

describe("calculateTooltipPosition and Tooltip behaviors", () => {
  it("clamps tooltip position horizontally when trigger is near the right edge of mobile screen", () => {
    const triggerRect = { left: 300, right: 316, top: 100, bottom: 116 };
    const tooltipRect = { width: 256, height: 100 };
    const viewport = { width: 375, height: 667 };

    const style = calculateTooltipPosition(triggerRect, tooltipRect, viewport);

    expect(style.position).toBe("fixed");
    expect(style.left).toBe("107px");
    expect(style.top).toBe("122px");
    expect(style.transform).toBe("none");
  });

  it("clamps tooltip position horizontally when trigger is near the left edge of mobile screen", () => {
    const triggerRect = { left: 4, right: 20, top: 100, bottom: 116 };
    const tooltipRect = { width: 256, height: 100 };
    const viewport = { width: 375, height: 667 };

    const style = calculateTooltipPosition(triggerRect, tooltipRect, viewport);

    expect(style.position).toBe("fixed");
    expect(style.left).toBe("12px");
    expect(style.top).toBe("122px");
  });

  it("flips tooltip to open above trigger when near the bottom of the viewport", () => {
    const triggerRect = { left: 100, right: 116, top: 624, bottom: 640 };
    const tooltipRect = { width: 256, height: 100 };
    const viewport = { width: 375, height: 667 };

    const style = calculateTooltipPosition(triggerRect, tooltipRect, viewport);

    expect(style.position).toBe("fixed");
    expect(style.top).toBe("518px");
  });

  it("clamps and keeps tooltip on-screen on desktop viewports and DevTools", () => {
    // When trigger is near the right edge of a desktop/DevTools screen
    const triggerNearRight = { left: 900, right: 916, top: 100, bottom: 116 };
    const tooltipRect = { width: 256, height: 100 };
    const viewport = { width: 1024, height: 768 };

    const styleRight = calculateTooltipPosition(triggerNearRight, tooltipRect, viewport);

    expect(styleRight.position).toBe("fixed");
    expect(Number.parseInt(styleRight.left as string, 10)).toBeLessThanOrEqual(1024 - 256 - 12);
    expect(Number.parseInt(styleRight.left as string, 10)).toBeGreaterThanOrEqual(12);

    // When trigger has plenty of room on the right
    const triggerWithRoom = { left: 100, right: 116, top: 100, bottom: 116 };
    const styleWithRoom = calculateTooltipPosition(triggerWithRoom, tooltipRect, viewport);
    expect(styleWithRoom.position).toBe("fixed");
    expect(styleWithRoom.left).toBe("124px");
  });

  it("SynergyExplainerButton renders info icon button and markup cleanly", () => {
    const html = renderToStaticMarkup(<SynergyExplainerButton description="Test synergy explainer" />);

    expect(html).toContain('aria-label="How synergy is calculated"');
    expect(html).toContain("<button");
  });

  it("useTooltipPosition does not trigger infinite re-renders or exceed update depth with inline callbacks", () => {
    function TestConsumer() {
      const [isOpen, setIsOpen] = React.useState(false);
      // Passing inline arrow function as onClose (common pattern in GroupVisibilityControl, etc.)
      const { style } = useTooltipPosition(isOpen, () => setIsOpen(false));
      return <div data-testid="test-consumer" style={style}>{isOpen ? "open" : "closed"}</div>;
    }

    expect(() => {
      const html = renderToStaticMarkup(<TestConsumer />);
      expect(html).toContain("closed");
    }).not.toThrow();
  });
});

