import {
  Target,
  MessageSquare,
  ClipboardList,
} from "lucide-react";

export const RESULT_STAGES = [
  {
    id: "challenge",
    step: 1,
    label: "The challenge",
    shortLabel: "Challenge",
    description: "What you were asked to do",
    icon: Target,
  },
  {
    id: "conversation",
    step: 2,
    label: "The conversation",
    shortLabel: "Conversation",
    description: "What happened in the session",
    icon: MessageSquare,
  },
  {
    id: "assessment",
    step: 3,
    label: "Your assessment",
    shortLabel: "Assessment",
    description: "How you performed",
    icon: ClipboardList,
  },
] as const;

export type ResultStageId = (typeof RESULT_STAGES)[number]["id"];
