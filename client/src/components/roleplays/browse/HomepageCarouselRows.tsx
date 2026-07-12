import { useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  Sparkles,
  Heart,
  Laugh,
  ChartNoAxesCombined,
} from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { apiRequest } from "@heybray/react/lib/queryClient";
import {
  ScenarioBrowseCard,
  type ScenarioBrowseCardData,
} from "@/components/roleplays/ScenarioBrowseCard";
import { ScenarioBrowseCarouselRow } from "./ScenarioBrowseCarouselRow";
import { ScenarioCarouselRow } from "./ScenarioCarouselRow";
import { ScenarioCarouselCardSlot } from "./ScenarioCarouselCardSlot";
import { resolveLucideIcon } from "@heybray/react/lib/classification-display";
import {
  carouselWidthForCardCount,
  getCarouselCardMetrics,
  packCarouselShelf,
} from "./carousel-card-layout";

type CategoryOption = {
  slug: string;
  label: string;
  icon: string;
  color: string;
  usageCount: number;
};

type CarouselRowsProps = {
  canManage?: boolean;
  cardPropsFor: (
    rp: ScenarioBrowseCardData,
    canManage: boolean,
  ) => React.ComponentProps<typeof ScenarioBrowseCard>;
  categoryOptions?: CategoryOption[];
};

export function HomepageCarouselRows({
  canManage = false,
  cardPropsFor,
  categoryOptions = [],
}: CarouselRowsProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Curated rows: always full-width, never packed beside other carousels */}
      <ScenarioBrowseCarouselRow
        title="Continue where you left off"
        icon={RotateCcw}
        queryKey={["/api/roleplays/continue"]}
        queryFn={() => apiRequest("GET", "/api/roleplays/continue?limit=20")}
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
      <ScenarioBrowseCarouselRow
        title="Popular right now"
        icon={Laugh}
        queryKey={["/api/roleplays/popular"]}
        queryFn={() => apiRequest("GET", "/api/roleplays/popular?limit=20")}
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
      <ScenarioBrowseCarouselRow
        title="Most recently added"
        icon={Sparkles}
        queryKey={["/api/roleplays/recent"]}
        queryFn={() =>
          apiRequest("GET", "/api/roleplays?sort=publishedAt&limit=20&page=1")
        }
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
      <ScenarioBrowseCarouselRow
        title="Things we think you'll like"
        icon={Heart}
        queryKey={["/api/roleplays/recommended"]}
        queryFn={() => apiRequest("GET", "/api/roleplays/recommended?limit=20")}
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
      <ScenarioBrowseCarouselRow
        title="Room for Improvement"
        icon={ChartNoAxesCombined}
        queryKey={["/api/roleplays/room-for-improvement"]}
        queryFn={() =>
          apiRequest("GET", "/api/roleplays/room-for-improvement?limit=20")
        }
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
      <CategoryCarouselShelf
        categoryOptions={categoryOptions}
        canManage={canManage}
        cardPropsFor={cardPropsFor}
      />
    </div>
  );
}

type CategoryShelfItem = CategoryOption & {
  items: ScenarioBrowseCardData[];
  cardCount: number;
};

function CategoryCarouselShelf({
  categoryOptions,
  canManage,
  cardPropsFor,
}: {
  categoryOptions: CategoryOption[];
  canManage?: boolean;
  cardPropsFor: CarouselRowsProps["cardPropsFor"];
}) {
  const shelfRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = shelfRef.current;
    if (!el) return;

    const update = () => setContainerWidth(el.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const categoryQueries = useQueries({
    queries: categoryOptions.map((category) => ({
      queryKey: ["/api/roleplays/category-row", category.slug],
      queryFn: () =>
        apiRequest("GET", `/api/roleplays?category=${encodeURIComponent(category.slug)}&limit=20&page=1`) as Promise<{
          items: ScenarioBrowseCardData[];
        }>,
    })),
  });

  // useQueries returns a new array each render — key off status/data for memoization.
  const categoryQueryKey = categoryQueries
    .map(
      (q) =>
        `${q.fetchStatus}:${q.status}:${q.dataUpdatedAt}:${q.data?.items?.length ?? 0}`,
    )
    .join("|");

  const shelfItems = useMemo(() => {
    const loaded: CategoryShelfItem[] = [];
    for (let i = 0; i < categoryOptions.length; i++) {
      const query = categoryQueries[i];
      if (!query || query.isLoading || query.isError) continue;
      const items = query.data?.items ?? [];
      if (!items.length) continue;
      const category = categoryOptions[i]!;
      loaded.push({
        ...category,
        items,
        cardCount: items.length,
      });
    }
    // Descending by #scenarios, then label for stability.
    loaded.sort(
      (a, b) =>
        b.usageCount - a.usageCount || a.label.localeCompare(b.label),
    );
    return loaded;
    // categoryQueries is read from the latest render when categoryQueryKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryOptions, categoryQueryKey]);

  const { cardWidthPx, gapPx, slotsPerRow } = useMemo(
    () => getCarouselCardMetrics(containerWidth || 1),
    [containerWidth],
  );

  const packedRows = useMemo(
    () =>
      containerWidth > 0
        ? packCarouselShelf(shelfItems, slotsPerRow)
        : [],
    [shelfItems, slotsPerRow, containerWidth],
  );

  const stillLoading =
    categoryOptions.length > 0 &&
    categoryQueries.some((q) => q.isLoading) &&
    shelfItems.length === 0;

  return (
    <div ref={shelfRef} className="flex flex-col gap-6 min-w-0">
      {stillLoading && (
        <p className="text-sm text-muted-foreground py-2">Loading categories…</p>
      )}
      {packedRows.map((row, rowIndex) => {
        const isSingleFullRow =
          row.length === 1 && row[0]!.cardCount >= slotsPerRow;

        return (
          <div
            key={row.map((c) => c.slug).join("|") || rowIndex}
            className="flex flex-wrap gap-x-3 gap-y-6 items-start min-w-0"
          >
            {row.map((category) => {
              const Icon = resolveLucideIcon(category.icon);
              const packable = !isSingleFullRow;
              const widthPx = packable
                ? carouselWidthForCardCount(
                    category.cardCount,
                    cardWidthPx,
                    gapPx,
                  )
                : undefined;

              return (
                <ScenarioCarouselRow
                  key={category.slug}
                  title={category.label}
                  icon={Icon}
                  iconColor={category.color}
                  packable={packable}
                  className={packable ? undefined : "w-full min-w-0"}
                  style={
                    packable && widthPx
                      ? { width: widthPx, maxWidth: "100%" }
                      : undefined
                  }
                >
                  {category.items.map((rp) => (
                    <ScenarioCarouselCardSlot key={rp.id}>
                      <ScenarioBrowseCard
                        {...cardPropsFor(rp, !!canManage)}
                        layout="carousel"
                      />
                    </ScenarioCarouselCardSlot>
                  ))}
                </ScenarioCarouselRow>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
