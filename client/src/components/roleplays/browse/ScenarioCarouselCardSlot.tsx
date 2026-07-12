import { cn } from "@/lib/utils";
import {
  CAROUSEL_CARD_INNER_CLASS,
  CAROUSEL_CARD_SLOT_CLASS,
} from "./carousel-card-layout";

type ScenarioCarouselCardSlotProps = {
  children: React.ReactNode;
  className?: string;
};

export function ScenarioCarouselCardSlot({
  children,
  className,
}: ScenarioCarouselCardSlotProps) {
  return (
    <div className={cn(CAROUSEL_CARD_SLOT_CLASS, className)}>
      <div className={CAROUSEL_CARD_INNER_CLASS}>{children}</div>
    </div>
  );
}
