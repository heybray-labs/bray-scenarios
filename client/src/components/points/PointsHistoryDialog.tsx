import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, SquareArrowOutUpRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { RewardTierLabel } from "@/components/points/RewardTierLabel";
import { starLevelFromTierName } from "@shared/schemas/points";

type PointsHistoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type HistoryItem = {
  id: number;
  amount: number;
  tierName: string | null;
  tierColor: string | null;
  tierStarLevel: number | null;
  description: string | null;
  createdAt: string;
  roleplayId: number | null;
  roleplayTitle: string | null;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PointsHistoryDialog({ open, onOpenChange }: PointsHistoryDialogProps) {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = useQuery<{
    items: HistoryItem[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/points/me/history", page, pageSize],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/points/me/history?page=${page}&limit=${pageSize}`,
      ),
    enabled: open,
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPage(1);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          "w-[50vw] max-w-[50vw] min-w-[24rem]",
          "h-[40vh] max-h-[40vh] min-h-[16rem]",
        )}
      >
        <DialogHeader className="shrink-0 px-4 pt-4 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-amber-500" />
            Points history
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No points earned yet. Complete scenarios to start earning points.
            </p>
          ) : (
            <table className="w-full text-sm mt-2">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 pr-3 text-left font-medium">Date & time</th>
                  <th className="py-2 pr-3 text-left font-medium">Scenario</th>
                  <th className="py-2 pr-3 text-left font-medium">Achievement</th>
                  <th className="py-2 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap align-top">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-medium align-top">
                      <span className="inline-flex items-center gap-1.5 max-w-full">
                        <span className="line-clamp-2">{item.roleplayTitle ?? "Scenario"}</span>
                        {item.roleplayId != null && (
                          <Link
                            href={`/roleplays/${item.roleplayId}`}
                            className="shrink-0 text-muted-foreground hover:text-primary"
                            title="Open scenario"
                            onClick={() => onOpenChange(false)}
                          >
                            <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </span>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      {item.tierName ? (
                        <RewardTierLabel
                          compact
                          tierName={item.tierName}
                          starLevel={item.tierStarLevel ?? starLevelFromTierName(item.tierName)}
                          color={item.tierColor}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold text-amber-600 tabular-nums align-top whitespace-nowrap">
                      +{item.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
