import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  ScenarioMiniCard,
  ScenarioMiniCardRow,
  useScenarioMiniNavigate,
} from "./ScenarioMiniCard";
import { maxRewardPoints } from "@shared/schemas/points";

type NewScenarioItem = {
  id: number;
  title: string;
  coverImageMediaId?: number | null;
  difficulty?: string | null;
  rewardTiers?: Array<{ rewardPoints?: number }>;
  publishedAt?: string | null;
};

export function NewScenarioRow() {
  const navigate = useScenarioMiniNavigate();
  const publishedSince = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);

  const { data } = useQuery<{ items: NewScenarioItem[] }>({
    queryKey: ["/api/roleplays/new-row", publishedSince],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/roleplays?sort=publishedAt&myStatus=not_started&limit=10&publishedSince=${encodeURIComponent(publishedSince)}`,
      ),
  });

  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <ScenarioMiniCardRow title="New scenarios" icon={Sparkles}>
      {items.map((item) => {
        const pts = maxRewardPoints(item.rewardTiers ?? []);
        const difficulty = item.difficulty
          ? item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)
          : null;
        return (
          <ScenarioMiniCard
            key={item.id}
            item={{
              roleplayId: item.id,
              title: item.title,
              coverImageMediaId: item.coverImageMediaId,
              ribbon: { label: "New", variant: "new" },
              showStarClip: false,
              hookClassName: "text-muted-foreground",
              hookLine: (
                <>
                  {difficulty && <span>{difficulty}</span>}
                  {difficulty && pts > 0 && <span> · </span>}
                  {pts > 0 && <span>up to {pts} pts</span>}
                </>
              ),
            }}
            onClick={() => navigate(item.id)}
          />
        );
      })}
    </ScenarioMiniCardRow>
  );
}
