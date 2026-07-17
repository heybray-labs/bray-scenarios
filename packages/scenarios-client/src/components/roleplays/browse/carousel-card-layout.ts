/** Shared carousel card footprint — hero cinema cards and browse cards use the same slot size. */

/** 17.5rem / 18.5rem wide; 16:9 cover height at 17.5rem ≈ 9.84rem */
export const CAROUSEL_COVER_HEIGHT_CLASS = "h-[9.84375rem]";

export const CAROUSEL_CARD_HEIGHT_CLASS = "h-[24.5rem]";

export const CAROUSEL_CARD_WIDTH_CLASS = "w-[17.5rem] sm:w-[18.5rem]";

/** Matches Tailwind `sm` and the card width breakpoint above. */
export const CAROUSEL_CARD_WIDTH_REM = 17.5;
export const CAROUSEL_CARD_WIDTH_SM_REM = 18.5;
/** Matches in-row / between-carousel `gap-3`. */
export const CAROUSEL_CARD_GAP_REM = 0.75;

export const CAROUSEL_CARD_SLOT_CLASS = [
  CAROUSEL_CARD_WIDTH_CLASS,
  "min-w-[17.5rem] max-w-[17.5rem] sm:min-w-[18.5rem] sm:max-w-[18.5rem]",
  "flex-none shrink-0 grow-0 snap-start scroll-ml-1",
  CAROUSEL_CARD_HEIGHT_CLASS,
  "overflow-hidden",
].join(" ");

/** Wider 16:9 cinema tile — same height as browse cards, image fills the full frame. */
export const HERO_CINEMA_SLOT_CLASS = [
  CAROUSEL_CARD_HEIGHT_CLASS,
  "aspect-video",
  "w-auto min-w-0 max-w-none",
  "flex-none shrink-0 grow-0 snap-start scroll-ml-1",
  "overflow-hidden",
].join(" ");

export const CAROUSEL_CARD_INNER_CLASS = "h-full min-h-0 min-w-0 max-w-full flex flex-col overflow-hidden";

export function getCarouselCardMetrics(containerWidthPx: number): {
  cardWidthPx: number;
  gapPx: number;
  slotsPerRow: number;
} {
  const rootFontPx =
    typeof document !== "undefined"
      ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      : 16;
  const isSm =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 640px)").matches;
  const cardWidthPx =
    (isSm ? CAROUSEL_CARD_WIDTH_SM_REM : CAROUSEL_CARD_WIDTH_REM) * rootFontPx;
  const gapPx = CAROUSEL_CARD_GAP_REM * rootFontPx;
  const slotsPerRow = Math.max(
    1,
    Math.floor((containerWidthPx + gapPx) / (cardWidthPx + gapPx)),
  );
  return { cardWidthPx, gapPx, slotsPerRow };
}

export function carouselWidthForCardCount(
  cardCount: number,
  cardWidthPx: number,
  gapPx: number,
): number {
  if (cardCount <= 0) return 0;
  return cardCount * cardWidthPx + (cardCount - 1) * gapPx;
}

/**
 * Shelf-pack carousels into rows.
 * Prefer priority order (caller should sort descending by scenario count).
 * When a row has leftover slots, pull the next later item that fits those slots.
 * Carousels wider than the row take a full row alone (scrollable).
 */
export function packCarouselShelf<T extends { cardCount: number }>(
  items: T[],
  slotsPerRow: number,
): T[][] {
  if (slotsPerRow < 1 || items.length === 0) return [];

  const remaining = [...items];
  const rows: T[][] = [];

  while (remaining.length > 0) {
    const row: T[] = [];
    let used = 0;

    while (remaining.length > 0 && used < slotsPerRow) {
      const free = slotsPerRow - used;
      let idx = -1;

      if (used === 0) {
        // Start the row with the highest-priority remaining carousel.
        idx = 0;
      } else {
        // Look ahead for the next priority item that fits the leftover slots.
        idx = remaining.findIndex((item) => item.cardCount <= free);
      }

      if (idx === -1) break;

      const [item] = remaining.splice(idx, 1);
      if (used === 0 && item.cardCount >= slotsPerRow) {
        row.push(item);
        used = slotsPerRow;
        break;
      }

      row.push(item);
      used += item.cardCount;
    }

    rows.push(row);
  }

  return rows;
}