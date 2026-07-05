import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchAndDownloadExport } from "@/lib/roleplay-transfer";
import { CoverImagePicker } from "@/components/roleplays/CoverImagePicker";
import { ClassificationOptionLabel } from "@/components/classifications/ClassificationOptionLabel";
import { classificationChipStyle, resolveLucideIcon } from "@/lib/classification-display";
import {
  Loader2,
  Plus,
  Trash2,
  Drama,
  Download,
  FileText,
  UserRound,
  ListChecks,
  Settings2,
  Trophy,
} from "lucide-react";
import {
  DEFAULT_REWARD_TIERS as SHARED_DEFAULT_REWARD_TIERS,
  REWARD_TIER_ICON_OPTIONS,
  resolveRewardTierDisplay,
} from "@shared/schemas/points";

interface RoleplayBuilderDialogProps {
  roleplayId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (roleplayId: number) => void;
}

interface CriterionDraft {
  id?: number;
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

interface RewardTierDraft {
  id?: number;
  tierName: string;
  minScorePercent: number;
  rewardPoints: number;
  color: string;
  icon: string;
}

const DEFAULT_REWARD_TIERS: RewardTierDraft[] = SHARED_DEFAULT_REWARD_TIERS.map((tier) => ({
  tierName: tier.tierName,
  minScorePercent: tier.minScorePercent,
  rewardPoints: tier.rewardPoints,
  color: tier.color ?? resolveRewardTierDisplay(tier).color,
  icon: tier.icon ?? resolveRewardTierDisplay(tier).icon,
}));

const DEFAULT_CRITERIA: CriterionDraft[] = [
  { name: "Empathy", description: "Acknowledged feelings and built rapport.", weight: 1, maxScore: 100 },
  { name: "Resolution", description: "Resolved the issue and met the objective.", weight: 1, maxScore: 100 },
  { name: "Compliance", description: "Followed the required process and policies.", weight: 1, maxScore: 100 },
];

export default function RoleplayBuilderDialog({
  roleplayId,
  open,
  onOpenChange,
  onSave,
}: RoleplayBuilderDialogProps) {
  const { toast } = useToast();
  const isEdit = roleplayId !== null;

  // Scenario
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [introduction, setIntroduction] = useState("");
  const [learnerRole, setLearnerRole] = useState("");
  const [situationContext, setSituationContext] = useState("");
  const [learnerObjective, setLearnerObjective] = useState("");
  const [playbook, setPlaybook] = useState("");
  const [status, setStatus] = useState("draft");
  const [coverImageMediaId, setCoverImageMediaId] = useState<number | null>(null);
  const [categorySlug, setCategorySlug] = useState("");
  const [audienceLevelSlug, setAudienceLevelSlug] = useState("");
  const [durationSlug, setDurationSlug] = useState("");
  const [tagSlugs, setTagSlugs] = useState<string[]>([]);

  // Persona
  const [personaName, setPersonaName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [personalityTraits, setPersonalityTraits] = useState("");
  const [mood, setMood] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [backgroundFacts, setBackgroundFacts] = useState("");
  const [hiddenObjective, setHiddenObjective] = useState("");
  const [openingStyle, setOpeningStyle] = useState("");

  // Settings
  const [maxAttempts, setMaxAttempts] = useState<number | "">("");
  const [passThreshold, setPassThreshold] = useState(70);
  const [allowManualEnd, setAllowManualEnd] = useState(true);
  const [maxTurns, setMaxTurns] = useState<number | "">("");
  const [autoEndOnMaxTurns, setAutoEndOnMaxTurns] = useState(false);
  const [allowAiEnd, setAllowAiEnd] = useState(false);
  const [liveCoaching, setLiveCoaching] = useState(false);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | "">("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [anonymousLeaderboard, setAnonymousLeaderboard] = useState(false);
  const [postSessionDisplayMode, setPostSessionDisplayMode] = useState("full_breakdown");
  const [personaModelKey, setPersonaModelKey] = useState("");
  const [graderModelKey, setGraderModelKey] = useState("");

  const [criteria, setCriteria] = useState<CriterionDraft[]>(DEFAULT_CRITERIA);
  const [rewardTiers, setRewardTiers] = useState<RewardTierDraft[]>(DEFAULT_REWARD_TIERS);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!roleplayId) return;
    setExporting(true);
    try {
      await fetchAndDownloadExport([roleplayId]);
      toast({
        title: "Scenario exported",
        description: "Exported the last saved version.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const { data: existing, isLoading } = useQuery<any>({
    queryKey: [`/api/roleplays/${roleplayId}`],
    enabled: isEdit && open,
  });

  const { data: personaModels } = useQuery<{
    models: { provider: string; model: string }[];
  }>({
    queryKey: [`/api/roleplays/available-models`, "persona"],
    queryFn: async () =>
      apiRequest("GET", `/api/roleplays/available-models?purpose=persona`),
    enabled: open,
  });

  const { data: graderModels } = useQuery<{
    models: { provider: string; model: string }[];
  }>({
    queryKey: [`/api/roleplays/available-models`, "grader"],
    queryFn: async () =>
      apiRequest("GET", `/api/roleplays/available-models?purpose=grader`),
    enabled: open,
  });

  const { data: taxonomy } = useQuery<{
    dimensions: Array<{
      slug: string;
      name: string;
      cardinality: string;
      options: Array<{ slug: string; label: string; color: string; icon: string }>;
    }>;
  }>({
    queryKey: ["/api/roleplay-classifications"],
    enabled: open,
  });

  const dimensionOptions = (slug: string) =>
    taxonomy?.dimensions.find((d) => d.slug === slug)?.options ?? [];

  const formatModelKey = (provider?: string | null, model?: string | null) =>
    provider && model ? `${provider}:${model}` : "";

  const formatModelLabel = (provider: string, model: string) => {
    const labels: Record<string, string> = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      google: "Google",
    };
    return `${labels[provider] ?? provider} · ${model}`;
  };

  const parseModelKey = (key: string) => {
    const idx = key.indexOf(":");
    if (idx <= 0) return null;
    return { provider: key.slice(0, idx), model: key.slice(idx + 1) };
  };

  useEffect(() => {
    if (!open || isEdit) return;
    setTitle("");
    setDescription("");
    setIntroduction("");
    setLearnerRole("");
    setSituationContext("");
    setLearnerObjective("");
    setPlaybook("");
    setStatus("draft");
    setCoverImageMediaId(null);
    setCategorySlug("");
    setAudienceLevelSlug("");
    setDurationSlug("");
    setTagSlugs([]);
    setPersonaName("");
    setRoleTitle("");
    setPersonalityTraits("");
    setMood("");
    setDifficulty("medium");
    setBackgroundFacts("");
    setHiddenObjective("");
    setOpeningStyle("");
    setMaxAttempts("");
    setPassThreshold(70);
    setAllowManualEnd(true);
    setMaxTurns("");
    setAutoEndOnMaxTurns(false);
    setAllowAiEnd(false);
    setLiveCoaching(false);
    setTimeLimitMinutes("");
    setShowLeaderboard(false);
    setAnonymousLeaderboard(false);
    setPostSessionDisplayMode("full_breakdown");
    setPersonaModelKey("");
    setGraderModelKey("");
    setCriteria(DEFAULT_CRITERIA);
    setRewardTiers(DEFAULT_REWARD_TIERS);
  }, [open, isEdit]);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title ?? "");
    setDescription(existing.description ?? "");
    setIntroduction(existing.introduction ?? "");
    setLearnerRole(existing.learnerRole ?? "");
    setSituationContext(existing.situationContext ?? "");
    setLearnerObjective(existing.learnerObjective ?? "");
    setPlaybook(existing.playbook ?? "");
    setStatus(existing.status ?? "draft");
    setCoverImageMediaId(existing.coverImageMediaId ?? null);

    const cls = existing.classifications ?? {};
    setCategorySlug(cls.category?.slug ?? "");
    setAudienceLevelSlug(cls.audienceLevel?.slug ?? "");
    setDurationSlug(cls.duration?.slug ?? "");
    setTagSlugs((cls.tags ?? []).map((t: { slug: string }) => t.slug));

    const p = existing.persona ?? {};
    setPersonaName(p.name ?? "");
    setRoleTitle(p.roleTitle ?? "");
    setPersonalityTraits(p.personalityTraits ?? "");
    setMood(p.mood ?? "");
    setDifficulty(p.difficulty ?? "medium");
    setBackgroundFacts(p.backgroundFacts ?? "");
    setHiddenObjective(p.hiddenObjective ?? "");
    setOpeningStyle(p.openingStyle ?? "");

    const s = existing.settings ?? {};
    setMaxAttempts(s.maxAttempts ?? "");
    setPassThreshold(s.passThreshold ?? 70);
    setAllowManualEnd(s.allowManualEnd ?? true);
    setMaxTurns(s.maxTurns ?? "");
    setAutoEndOnMaxTurns(s.autoEndOnMaxTurns ?? false);
    setAllowAiEnd(s.allowAiEnd ?? false);
    setLiveCoaching(s.liveCoaching ?? false);
    setTimeLimitMinutes(s.timeLimitMinutes ?? "");
    setShowLeaderboard(s.showLeaderboard ?? false);
    setAnonymousLeaderboard(s.anonymousLeaderboard ?? false);
    setPostSessionDisplayMode(s.postSessionDisplayMode ?? "full_breakdown");
    setPersonaModelKey(formatModelKey(s.personaProvider, s.personaModel));
    setGraderModelKey(formatModelKey(s.graderProvider, s.graderModel));

    if (Array.isArray(existing.criteria) && existing.criteria.length) {
      setCriteria(
        existing.criteria.map((c: any) => ({
          id: c.id,
          name: c.name ?? "",
          description: c.description ?? "",
          weight: parseFloat(String(c.weight ?? 1)) || 1,
          maxScore: c.maxScore ?? 100,
        })),
      );
    }

    if (Array.isArray(existing.rewardTiers) && existing.rewardTiers.length) {
      setRewardTiers(
        sortRewardTiers(
          existing.rewardTiers.map((t: any) => {
            const resolved = resolveRewardTierDisplay({
              tierName: t.tierName ?? "",
              color: t.color,
              icon: t.icon,
            });
            return {
              id: t.id,
              tierName: t.tierName ?? "",
              minScorePercent: t.minScorePercent ?? 0,
              rewardPoints: t.rewardPoints ?? 0,
              color: resolved.color,
              icon: resolved.icon,
            };
          }),
        ),
      );
    } else {
      setRewardTiers(DEFAULT_REWARD_TIERS);
    }
  }, [existing]);

  const buildPayload = (nextStatus?: string) => ({
    roleplay: {
      title,
      description,
      introduction,
      learnerRole,
      situationContext,
      learnerObjective,
      playbook,
      status: nextStatus ?? status,
      coverImageMediaId,
    },
    settings: {
      maxAttempts: maxAttempts === "" ? null : Number(maxAttempts),
      passThreshold: Number(passThreshold),
      allowManualEnd,
      maxTurns: maxTurns === "" ? null : Number(maxTurns),
      autoEndOnMaxTurns,
      allowAiEnd,
      liveCoaching,
      timeLimitMinutes: timeLimitMinutes === "" ? null : Number(timeLimitMinutes),
      showLeaderboard,
      anonymousLeaderboard,
      postSessionDisplayMode,
      ...(() => {
        const p = parseModelKey(personaModelKey);
        const g = parseModelKey(graderModelKey);
        return {
          personaProvider: p?.provider ?? null,
          personaModel: p?.model ?? null,
          graderProvider: g?.provider ?? null,
          graderModel: g?.model ?? null,
        };
      })(),
    },
    persona: {
      name: personaName,
      roleTitle,
      personalityTraits,
      mood,
      difficulty,
      backgroundFacts,
      hiddenObjective,
      openingStyle,
    },
    criteria: criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
    })),
    rewardTiers: rewardTiers.map((t, index) => ({
      id: t.id,
      tierName: t.tierName,
      minScorePercent: Number(t.minScorePercent),
      rewardPoints: Number(t.rewardPoints),
      orderIndex: index,
      color: t.color,
      icon: t.icon,
    })),
    classifications: {
      category: categorySlug || null,
      audienceLevel: audienceLevelSlug || null,
      duration: durationSlug || null,
      tags: tagSlugs,
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (nextStatus?: string) => {
      const payload = buildPayload(nextStatus);
      if (isEdit) {
        return apiRequest("PUT", `/api/roleplays/${roleplayId}`, payload);
      }
      return apiRequest("POST", `/api/roleplays`, payload);
    },
    onSuccess: (saved: any) => {
      toast({ title: isEdit ? "Roleplay updated" : "Roleplay created" });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      if (saved?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${saved.id}`] });
      }
      onSave?.(saved.id);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (!title.trim()) errors.push("Add a title on the Scenario tab");
    if (!personaModelKey) errors.push("Select a persona model on the Persona tab");
    if (!graderModelKey) errors.push("Select an assessor model on the Rubric tab");
    return errors;
  };

  const handleSave = (nextStatus: string) => {
    if (nextStatus === "draft" && status === "published") {
      const confirmed = window.confirm(
        "This scenario is currently published. Saving as a draft will make it unavailable to users until you publish it again.\n\nSave as draft anyway?",
      );
      if (!confirmed) return;
    }

    if (nextStatus !== "draft") {
      const errors = getValidationErrors();
      if (errors.length > 0) {
        toast({
          title: "Complete required fields to publish",
          description:
            errors.length === 1 ? (
              errors[0]
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-4">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ),
          variant: "destructive",
        });
        return;
      }
    }
    saveMutation.mutate(nextStatus);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[60vh] max-h-[60vh] flex flex-col overflow-hidden gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Drama className="h-5 w-5" />
            {isEdit ? "Edit Roleplay" : "New Roleplay"}
          </DialogTitle>
        </DialogHeader>

        {isEdit && isLoading ? (
          <div className="flex flex-1 items-center justify-center min-h-0">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="scenario" className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-5 w-full shrink-0">
              <TabsTrigger value="scenario" className="gap-1.5">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">Scenario</span>
              </TabsTrigger>
              <TabsTrigger value="persona" className="gap-1.5">
                <UserRound className="h-4 w-4 shrink-0" />
                <span className="truncate">Persona</span>
              </TabsTrigger>
              <TabsTrigger value="rubric" className="gap-1.5">
                <ListChecks className="h-4 w-4 shrink-0" />
                <span className="truncate">Rubric</span>
              </TabsTrigger>
              <TabsTrigger value="rewards" className="gap-1.5">
                <Trophy className="h-4 w-4 shrink-0" />
                <span className="truncate">Rewards</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5">
                <Settings2 className="h-4 w-4 shrink-0" />
                <span className="truncate">Settings</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 mt-4 overflow-y-auto pr-3">
              {/* Scenario */}
              <TabsContent value="scenario" className="space-y-4 mt-0">
                <Field label="Title" required>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Handling an angry customer" />
                </Field>
                <Field label="Short description">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Category">
                    <Select value={categorySlug || undefined} onValueChange={setCategorySlug}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {dimensionOptions("category").map((opt) => (
                          <SelectItem key={opt.slug} value={opt.slug}>
                            <ClassificationOptionLabel
                              label={opt.label}
                              color={opt.color}
                              icon={opt.icon}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Audience level">
                    <Select value={audienceLevelSlug || undefined} onValueChange={setAudienceLevelSlug}>
                      <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>
                        {dimensionOptions("audience_level").map((opt) => (
                          <SelectItem key={opt.slug} value={opt.slug}>
                            <ClassificationOptionLabel
                              label={opt.label}
                              color={opt.color}
                              icon={opt.icon}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Duration">
                    <Select value={durationSlug || undefined} onValueChange={setDurationSlug}>
                      <SelectTrigger><SelectValue placeholder="Select duration" /></SelectTrigger>
                      <SelectContent>
                        {dimensionOptions("duration").map((opt) => (
                          <SelectItem key={opt.slug} value={opt.slug}>
                            <ClassificationOptionLabel
                              label={opt.label}
                              color={opt.color}
                              icon={opt.icon}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Tags">
                  <div className="flex flex-wrap gap-2">
                    {dimensionOptions("tags").map((opt) => {
                      const selected = tagSlugs.includes(opt.slug);
                      const Icon = resolveLucideIcon(opt.icon);
                      const chipStyle = classificationChipStyle(opt.color);
                      return (
                        <Button
                          key={opt.slug}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          style={
                            selected
                              ? {
                                  color: opt.color,
                                  backgroundColor: chipStyle.backgroundColor,
                                  borderColor: opt.color,
                                }
                              : undefined
                          }
                          onClick={() =>
                            setTagSlugs((prev) =>
                              selected
                                ? prev.filter((s) => s !== opt.slug)
                                : [...prev, opt.slug],
                            )
                          }
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {opt.label}
                        </Button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Cover image">
                  <CoverImagePicker
                    mediaId={coverImageMediaId}
                    onChange={setCoverImageMediaId}
                  />
                </Field>
                <Field label="Learner's role">
                  <Input value={learnerRole} onChange={(e) => setLearnerRole(e.target.value)} placeholder="e.g. Customer Support Agent" />
                </Field>
                <Field label="Context">
                  <Textarea value={situationContext} onChange={(e) => setSituationContext(e.target.value)} rows={3} placeholder="Describe the scenario setup the persona is reacting to." />
                </Field>
                <Field label="Current Situation">
                  <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={3} placeholder="What the learner walks into when the conversation starts." />
                </Field>
                <Field label="Learner's objective">
                  <Textarea value={learnerObjective} onChange={(e) => setLearnerObjective(e.target.value)} rows={2} placeholder="What should the learner achieve in this conversation?" />
                </Field>
                <Field label="Playbook (process & best practices used for grading)">
                  <Textarea value={playbook} onChange={(e) => setPlaybook(e.target.value)} rows={4} placeholder="Steps and best practices the learner should follow. The grader weighs adherence to this." />
                </Field>
              </TabsContent>

              {/* Persona */}
              <TabsContent value="persona" className="space-y-4 mt-0">
                <Field label="Persona model (AI that plays the character)" required>
                  <Select
                    value={personaModelKey || undefined}
                    onValueChange={setPersonaModelKey}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
                    <SelectContent>
                      {(personaModels?.models ?? []).length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          Configure persona models in Settings first
                        </SelectItem>
                      ) : (
                        (personaModels?.models ?? []).map((m) => {
                          const key = formatModelKey(m.provider, m.model);
                          return (
                            <SelectItem key={key} value={key}>
                              {formatModelLabel(m.provider, m.model)}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Persona name">
                  <Input value={personaName} onChange={(e) => setPersonaName(e.target.value)} placeholder="e.g. Sarah Jenkins" />
                </Field>
                <Field label="Persona role / title">
                  <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Frustrated long-time customer" />
                </Field>
                <Field label="Personality traits">
                  <Input value={personalityTraits} onChange={(e) => setPersonalityTraits(e.target.value)} placeholder="e.g. impatient, detail-oriented, skeptical" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Mood / emotional state">
                    <Input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="e.g. frustrated" />
                  </Field>
                  <Field label="Difficulty">
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Background facts (what the persona knows)">
                  <Textarea value={backgroundFacts} onChange={(e) => setBackgroundFacts(e.target.value)} rows={3} />
                </Field>
                <Field label="Hidden objective (what the persona secretly wants)">
                  <Textarea value={hiddenObjective} onChange={(e) => setHiddenObjective(e.target.value)} rows={2} />
                </Field>
                <Field label="Opening style (guidance for the first message)">
                  <Textarea value={openingStyle} onChange={(e) => setOpeningStyle(e.target.value)} rows={2} />
                </Field>
              </TabsContent>

              {/* Rubric */}
              <TabsContent value="rubric" className="space-y-4 mt-0">
                <Field label="Assessor model (AI that grades the attempt)" required>
                  <Select
                    value={graderModelKey || undefined}
                    onValueChange={setGraderModelKey}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
                    <SelectContent>
                      {(graderModels?.models ?? []).length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          Configure grader models in Settings first
                        </SelectItem>
                      ) : (
                        (graderModels?.models ?? []).map((m) => {
                          const key = formatModelKey(m.provider, m.model);
                          return (
                            <SelectItem key={key} value={key}>
                              {formatModelLabel(m.provider, m.model)}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </Field>
                <p className="text-sm text-muted-foreground">
                  Define weighted criteria. The AI scores each criterion 0–max and the overall
                  result is the weighted percentage.
                </p>
                {criteria.map((c, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={c.name}
                        onChange={(e) => updateCriterion(setCriteria, idx, { name: e.target.value })}
                        placeholder="Criterion name"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeAt(setCriteria, idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={c.description}
                      onChange={(e) => updateCriterion(setCriteria, idx, { description: e.target.value })}
                      placeholder="What does a good answer look like for this criterion?"
                      rows={2}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Weight">
                        <Input type="number" min={0} step="0.5" value={c.weight}
                          onChange={(e) => updateCriterion(setCriteria, idx, { weight: parseFloat(e.target.value) || 0 })} />
                      </Field>
                      <Field label="Max score">
                        <Input type="number" min={1} value={c.maxScore}
                          onChange={(e) => updateCriterion(setCriteria, idx, { maxScore: parseInt(e.target.value) || 100 })} />
                      </Field>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => setCriteria((prev) => [...prev, { name: "", description: "", weight: 1, maxScore: 100 }])}>
                  <Plus className="h-4 w-4 mr-1" /> Add criterion
                </Button>
              </TabsContent>

              {/* Rewards */}
              <TabsContent value="rewards" className="space-y-2 mt-0">
                <p className="text-xs text-muted-foreground">
                  Score thresholds and point rewards. Retakes only award the incremental
                  difference vs. a previous best tier.
                </p>
                <div className="rounded-md border overflow-hidden text-sm">
                  <div className="grid grid-cols-[2rem_5.5rem_minmax(0,1fr)_3.75rem_3.75rem_2rem] gap-x-2 items-center px-2 py-1.5 bg-muted/40 border-b text-[11px] font-medium text-muted-foreground">
                    <span aria-hidden />
                    <span>Icon</span>
                    <span>Name</span>
                    <span>Min %</span>
                    <span>Pts</span>
                    <span aria-hidden />
                  </div>
                  {rewardTiers.map((tier, idx) => {
                    const TierIcon = resolveLucideIcon(tier.icon);
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-[2rem_5.5rem_minmax(0,1fr)_3.75rem_3.75rem_2rem] gap-x-2 items-center px-2 py-1.5 border-b last:border-b-0"
                      >
                        <Input
                          type="color"
                          value={tier.color}
                          onChange={(e) =>
                            updateRewardTier(setRewardTiers, idx, { color: e.target.value })
                          }
                          className="h-7 w-7 p-0.5 cursor-pointer border-0 shadow-none"
                          title="Tier color"
                        />
                        <Select
                          value={tier.icon}
                          onValueChange={(value) => updateRewardTier(setRewardTiers, idx, { icon: value })}
                        >
                          <SelectTrigger className="h-8 px-2" title={tier.icon}>
                            <SelectValue>
                              <span className="flex items-center gap-1.5">
                                <TierIcon
                                  className="h-3.5 w-3.5 shrink-0"
                                  style={{ color: tier.color }}
                                />
                                <span className="truncate capitalize text-xs">{tier.icon}</span>
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-52">
                            {REWARD_TIER_ICON_OPTIONS.map((iconName) => {
                              const ItemIcon = resolveLucideIcon(iconName);
                              return (
                                <SelectItem key={iconName} value={iconName}>
                                  <span className="flex items-center gap-2">
                                    <ItemIcon className="h-4 w-4" />
                                    <span className="capitalize">{iconName}</span>
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <Input
                          value={tier.tierName}
                          onChange={(e) => {
                            const tierName = e.target.value;
                            const preset = resolveRewardTierDisplay({ tierName });
                            updateRewardTier(setRewardTiers, idx, {
                              tierName,
                              color: preset.color,
                              icon: preset.icon,
                            });
                          }}
                          placeholder="Gold"
                          className="h-8"
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={tier.minScorePercent}
                          onChange={(e) =>
                            updateRewardTier(setRewardTiers, idx, {
                              minScorePercent: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-8 px-2"
                        />
                        <Input
                          type="number"
                          min={0}
                          value={tier.rewardPoints}
                          onChange={(e) =>
                            updateRewardTier(setRewardTiers, idx, {
                              rewardPoints: parseInt(e.target.value) || 0,
                            })
                          }
                          className="h-8 px-2"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeAt(setRewardTiers, idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() =>
                    setRewardTiers((prev) =>
                      sortRewardTiers([
                        ...prev,
                        {
                          tierName: "",
                          minScorePercent: 0,
                          rewardPoints: 0,
                          color: resolveRewardTierDisplay({ tierName: "" }).color,
                          icon: resolveRewardTierDisplay({ tierName: "" }).icon,
                        },
                      ]),
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-1" /> Add tier
                </Button>
              </TabsContent>

              {/* Settings */}
              <TabsContent value="settings" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Max attempts (blank = unlimited)">
                    <Input type="number" min={1} value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value === "" ? "" : parseInt(e.target.value))} />
                  </Field>
                  <Field label="Pass threshold (%)">
                    <Input type="number" min={0} max={100} value={passThreshold}
                      onChange={(e) => setPassThreshold(parseInt(e.target.value) || 0)} />
                  </Field>
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Conversation end conditions</p>
                  <ToggleRow label="Learner can end & submit" checked={allowManualEnd} onChange={setAllowManualEnd} />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Max learner turns (blank = none)">
                      <Input type="number" min={1} value={maxTurns}
                        onChange={(e) => setMaxTurns(e.target.value === "" ? "" : parseInt(e.target.value))} />
                    </Field>
                  </div>
                  <ToggleRow label="Auto-submit when max turns reached" checked={autoEndOnMaxTurns} onChange={setAutoEndOnMaxTurns} />
                  <ToggleRow label="Persona may end the conversation" checked={allowAiEnd} onChange={setAllowAiEnd} />
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Coaching & timing</p>
                  <ToggleRow label="Live in-conversation coaching hints" checked={liveCoaching} onChange={setLiveCoaching} />
                  <Field label="Time limit (minutes, blank = none)">
                    <Input type="number" min={1} value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(e.target.value === "" ? "" : parseInt(e.target.value))} />
                  </Field>
                </div>

                <div className="rounded-md border p-3 space-y-3">
                  <p className="text-sm font-medium">Results & leaderboard</p>
                  <Field label="Post-session display">
                    <Select value={postSessionDisplayMode} onValueChange={setPostSessionDisplayMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thank_you_only">Thank-you only</SelectItem>
                        <SelectItem value="overall_only">Overall score only</SelectItem>
                        <SelectItem value="full_breakdown">Full rubric breakdown</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <ToggleRow label="Show leaderboard" checked={showLeaderboard} onChange={setShowLeaderboard} />
                  <ToggleRow label="Anonymous leaderboard" checked={anonymousLeaderboard} onChange={setAnonymousLeaderboard} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}

        <DialogFooter className="gap-2 sm:justify-between shrink-0">
          <div className="flex gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={exporting || isLoading}
                onClick={() => void handleExport()}
                title="Exports the last saved version"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              variant="secondary"
              disabled={saveMutation.isPending}
              onClick={() => handleSave("draft")}
            >
              Save draft
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => handleSave("published")}
            >
              {saveMutation.isPending ? "Saving…" : "Save & publish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="font-normal">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function sortRewardTiers(tiers: RewardTierDraft[]): RewardTierDraft[] {
  return [...tiers].sort((a, b) => a.minScorePercent - b.minScorePercent);
}

function updateRewardTier(
  setter: React.Dispatch<React.SetStateAction<RewardTierDraft[]>>,
  idx: number,
  patch: Partial<RewardTierDraft>,
) {
  setter((prev) => {
    const next = prev.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    return patch.minScorePercent !== undefined ? sortRewardTiers(next) : next;
  });
}

function updateCriterion<T>(
  setter: React.Dispatch<React.SetStateAction<T[]>>,
  idx: number,
  patch: Partial<T>,
) {
  setter((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
}

function removeAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, idx: number) {
  setter((prev) => prev.filter((_, i) => i !== idx));
}
