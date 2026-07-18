import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@heybray/ui/components/button";
import { cn } from "@heybray/ui/utils";

type ScenarioCarouselRowProps = {
  title?: string;
  icon?: LucideIcon;
  /** Optional accent for the title icon (e.g. category color). */
  iconColor?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  /**
   * When true, the row sizes to its cards (capped at full width) so a following
   * short row can sit beside it in a wrapping flex parent.
   */
  packable?: boolean;
  scrollRef?: RefObject<HTMLDivElement>;
  onScroll?: () => void;
  /** Custom slot query for non-uniform carousel children (e.g. hero cinema tiles). */
  getScrollSlots?: (el: HTMLDivElement) => HTMLElement[];
  /** Override default arrow navigation (e.g. hero carousel index control). */
  onNavigate?: (direction: "left" | "right") => void;
};

export function ScenarioCarouselRow({
  title,
  icon: Icon,
  iconColor,
  hint,
  children,
  className,
  style,
  packable = false,
  scrollRef: externalScrollRef,
  onScroll,
  getScrollSlots,
  onNavigate,
}: ScenarioCarouselRowProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const scrollBy = (direction: "left" | "right") => {
    if (onNavigate) {
      onNavigate(direction);
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    // Prefer snapping to the adjacent card. Fractional viewport scrolls fail for
    // wide hero cinema tiles: snap-mandatory pulls back to the current slot.
    const slots = getScrollSlots ? getScrollSlots(el) : (Array.from(el.children) as HTMLElement[]);
    if (slots.length > 0) {
      const scrollLeft = el.scrollLeft;
      let nearest = 0;
      let nearestDist = Infinity;
      slots.forEach((slot, index) => {
        const dist = Math.abs(slot.offsetLeft - scrollLeft);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = index;
        }
      });
      const targetIndex =
        direction === "left"
          ? Math.max(0, nearest - 1)
          : Math.min(slots.length - 1, nearest + 1);
      const target = slots[targetIndex];
      if (target && targetIndex !== nearest) {
        el.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
        return;
      }
      if (targetIndex === nearest) return;
    }

    const amount = Math.max(280, el.clientWidth * 0.75);
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  const childCount = Array.isArray(children) ? children.length : children ? 1 : 0;

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [childCount, scrollRef]);

  return (
    <section
      style={style}
      className={cn(
        "group/row relative",
        packable && "w-max max-w-full min-w-0 shrink-0",
        className,
      )}
    >
      {title && (
        <div
          className={cn(
            "flex items-center gap-2 mb-2.5 min-w-0",
            // Don't let a long title widen a packable row past its cards.
            packable && "w-0 min-w-full",
          )}
        >
          {Icon && (
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                !iconColor && "text-muted-foreground",
              )}
              style={iconColor ? { color: iconColor } : undefined}
              aria-hidden
            />
          )}
          <h2 className="text-sm font-semibold tracking-tight truncate">{title}</h2>
          {hint && (
            <span className="ml-auto text-xs text-muted-foreground shrink-0">{hint}</span>
          )}
        </div>
      )}
      <div className="relative min-w-0 max-w-full">
        {canScrollLeft && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full shadow-md opacity-0 group-hover/row:opacity-100 transition-opacity hidden sm:flex pointer-events-auto"
            onClick={() => scrollBy("left")}
            aria-label={title ? `Scroll ${title} left` : "Scroll carousel left"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        {canScrollRight && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-0 top-1/2 z-20 h-8 w-8 -translate-y-1/2 rounded-full shadow-md opacity-0 group-hover/row:opacity-100 transition-opacity hidden sm:flex pointer-events-auto"
            onClick={() => scrollBy("right")}
            aria-label={title ? `Scroll ${title} right` : "Scroll carousel right"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
        <div
          ref={scrollRef}
          onScroll={() => {
            updateScrollState();
            onScroll?.();
          }}
          className="flex gap-3 overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory min-w-0 max-w-full"
        >
          {children}
        </div>
      </div>
    </section>
  );
}
