import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PlayCircle } from "lucide-react";
import { apiRequest } from "@heybray/react/lib/queryClient";
import { useAuthenticatedImage } from "@heybray/react/hooks/use-authenticated-image";
import { Button } from "@heybray/ui/components/button";
import { ClassificationChip } from "@/components/classifications/ClassificationChip";
import { DifficultyPill } from "@/components/classifications/DifficultyPill";
import { CardRibbon } from "@/components/roleplays/CardRibbon";
import { ScenarioCarouselRow } from "./ScenarioCarouselRow";
import { HERO_CINEMA_SLOT_CLASS } from "./carousel-card-layout";
import { cn } from "@heybray/ui/utils";

type FeaturedItem = {
  id: number;
  title: string;
  description?: string | null;
  coverImageMediaId?: number | null;
  difficulty?: string | null;
  classifications?: {
    category?: { label: string; color: string; icon: string } | null;
    audienceLevel?: { label: string; color: string; icon: string } | null;
  };
};

const ROTATE_MS = 7000;

function HeroFeaturedCard({
  item,
  onPlay,
}: {
  item: FeaturedItem;
  onPlay: () => void;
}) {
  const { src } = useAuthenticatedImage(item.coverImageMediaId);
  const category = item.classifications?.category ?? null;
  const audience = item.classifications?.audienceLevel ?? null;
  const hasDifficulty = Boolean(item.difficulty?.trim());

  return (
    <article className="group relative h-full w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10">
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-muted to-black/80" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(214,77,122,0.18),transparent_55%)]" />

      <CardRibbon
        variant="featured"
        className="top-3 tracking-[0.14em] px-2.5 py-1 shadow-md"
      >
        Featured
      </CardRibbon>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 p-4 pt-10">
        {(category || audience || hasDifficulty) && (
          <div className="flex flex-wrap gap-1.5">
            {category && (
              <ClassificationChip
                label={category.label}
                color={category.color}
                icon={category.icon}
                overlay
              />
            )}
            {hasDifficulty && (
              <DifficultyPill difficulty={item.difficulty!} variant="cover" />
            )}
            {audience && (
              <ClassificationChip
                label={audience.label}
                color={audience.color}
                icon={audience.icon}
                overlay
              />
            )}
          </div>
        )}

        <div className="space-y-1.5 min-w-0">
          <h3 className="text-lg font-bold leading-tight text-white line-clamp-2 drop-shadow-sm">
            {item.title}
          </h3>
          <p className="text-sm leading-snug text-white/80 line-clamp-2">
            {item.description?.trim() || "Step into this featured scenario."}
          </p>
        </div>

        <Button
          size="sm"
          className="w-fit gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          onClick={onPlay}
        >
          <PlayCircle className="h-4 w-4" />
          Play
        </Button>
      </div>
    </article>
  );
}

export function HeroFeaturedCarousel() {
  const [, navigate] = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const { data } = useQuery<{ items: FeaturedItem[] }>({
    queryKey: ["/api/roleplays/featured"],
    queryFn: () => apiRequest("GET", "/api/roleplays/featured"),
  });

  const items = data?.items ?? [];

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const slot = el.querySelectorAll("[data-hero-slot]")[index] as HTMLElement | undefined;
    if (slot) {
      el.scrollTo({ left: slot.offsetLeft, behavior: "smooth" });
    }
    setActiveIndex(index);
  };

  const syncActiveIndex = () => {
    const el = scrollRef.current;
    if (!el) return;
    const slots = Array.from(el.querySelectorAll("[data-hero-slot]")) as HTMLElement[];
    if (!slots.length) return;
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
    setActiveIndex(nearest);
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % items.length;
        const el = scrollRef.current;
        const slot = el?.querySelectorAll("[data-hero-slot]")[next] as HTMLElement | undefined;
        if (slot) {
          el!.scrollTo({ left: slot.offsetLeft, behavior: "smooth" });
        }
        return next;
      });
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  if (!items.length) return null;

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ScenarioCarouselRow
        scrollRef={scrollRef}
        onScroll={syncActiveIndex}
        getScrollSlots={(el) =>
          Array.from(el.querySelectorAll("[data-hero-slot]")) as HTMLElement[]
        }
        onNavigate={(direction) => {
          const next =
            direction === "left"
              ? Math.max(0, activeIndex - 1)
              : Math.min(items.length - 1, activeIndex + 1);
          if (next !== activeIndex) scrollToIndex(next);
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            data-hero-slot="true"
            className={cn(
              HERO_CINEMA_SLOT_CLASS,
              index === activeIndex &&
                "ring-2 ring-primary/50 ring-offset-2 ring-offset-background rounded-xl",
            )}
          >
            <HeroFeaturedCard
              item={item}
              onPlay={() => navigate(`/roleplays/${item.id}`)}
            />
          </div>
        ))}
      </ScenarioCarouselRow>
    </section>
  );
}
