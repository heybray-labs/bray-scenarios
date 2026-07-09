import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  ScenarioBrowseCard,
  type ScenarioBrowseCardData,
} from "@/components/roleplays/ScenarioBrowseCard";
import { ScenarioCarouselRow } from "./ScenarioCarouselRow";
import { ScenarioCarouselCardSlot } from "./ScenarioCarouselCardSlot";

type ScenarioBrowseCarouselRowProps = {
  title: string;
  icon?: LucideIcon;
  queryKey: unknown[];
  queryFn: () => Promise<{ items: ScenarioBrowseCardData[] }>;
  canManage?: boolean;
  packable?: boolean;
  cardPropsFor: (
    rp: ScenarioBrowseCardData,
    canManage: boolean,
  ) => React.ComponentProps<typeof ScenarioBrowseCard>;
};

export function ScenarioBrowseCarouselRow({
  title,
  icon,
  queryKey,
  queryFn,
  canManage = false,
  packable = false,
  cardPropsFor,
}: ScenarioBrowseCarouselRowProps) {
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn,
  });

  const items = data?.items ?? [];
  if (!isLoading && !items.length) return null;

  return (
    <ScenarioCarouselRow title={title} icon={icon} packable={packable}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 px-1">Loading…</p>
      ) : (
        items.map((rp) => (
          <ScenarioCarouselCardSlot key={rp.id}>
            <ScenarioBrowseCard {...cardPropsFor(rp, canManage)} layout="carousel" />
          </ScenarioCarouselCardSlot>
        ))
      )}
    </ScenarioCarouselRow>
  );
}
