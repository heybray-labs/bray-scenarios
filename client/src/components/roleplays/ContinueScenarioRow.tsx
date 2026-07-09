import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  ScenarioMiniCard,
  ScenarioMiniCardRow,
  formatRetryHook,
  useScenarioMiniNavigate,
} from "./ScenarioMiniCard";
import { TierStars } from "@/components/points/TierStars";

type ContinueItem = {
  roleplayId: number;
  title: string;
  coverImageMediaId: number | null;
  status: "in_progress" | "retry";
  bestScore: number | null;
  starLevel: number;
  nextTier: {
    name: string;
    minScorePercent: number;
    rewardPoints: number;
    starLevel: number;
  } | null;
  inProgressAttempt: { id: number; currentTurn: number; maxTurns: number | null } | null;
};

export function ContinueScenarioRow() {
  const navigate = useScenarioMiniNavigate();
  const { data } = useQuery<{ items: ContinueItem[] }>({
    queryKey: ["/api/roleplays/continue"],
    queryFn: () => apiRequest("GET", "/api/roleplays/continue?limit=10"),
  });

  const items = data?.items ?? [];
  if (!items.length) return null;

  return (
    <ScenarioMiniCardRow title="Continue where you left off" icon={RotateCcw}>
      {items.map((item) => {
        const inProgress = item.status === "in_progress" && item.inProgressAttempt;
        const retryHook = !inProgress
          ? formatRetryHook(item.bestScore, item.starLevel, item.nextTier)
          : null;

        return (
          <ScenarioMiniCard
            key={item.roleplayId}
            item={{
              roleplayId: item.roleplayId,
              title: item.title,
              coverImageMediaId: item.coverImageMediaId,
              starLevel: item.starLevel,
              ribbon: inProgress ? { label: "In progress", variant: "progress" } : undefined,
              hookClassName: inProgress
                ? "text-warning font-semibold"
                : retryHook?.className,
              hookLine: inProgress ? (
                <>
                  Resume — turn {item.inProgressAttempt!.currentTurn} of{" "}
                  {item.inProgressAttempt!.maxTurns ?? "?"}
                </>
              ) : retryHook?.stars != null ? (
                <>
                  {Math.round(item.bestScore ?? 0)} ·{" "}
                  <TierStars level={retryHook.stars} size="sm" /> — retry for 3 stars
                </>
              ) : (
                <span style={retryHook?.style}>{retryHook?.text}</span>
              ),
            }}
            onClick={() => navigate(item.roleplayId)}
          />
        );
      })}
    </ScenarioMiniCardRow>
  );
}
