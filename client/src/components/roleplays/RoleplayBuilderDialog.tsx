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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus, Trash2, Drama } from "lucide-react";

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
    if (!existing) return;
    setTitle(existing.title ?? "");
    setDescription(existing.description ?? "");
    setIntroduction(existing.introduction ?? "");
    setLearnerRole(existing.learnerRole ?? "");
    setSituationContext(existing.situationContext ?? "");
    setLearnerObjective(existing.learnerObjective ?? "");
    setPlaybook(existing.playbook ?? "");
    setStatus(existing.status ?? "draft");

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
        if (!p || !g) throw new Error("Persona and grader models are required");
        return {
          personaProvider: p.provider,
          personaModel: p.model,
          graderProvider: g.provider,
          graderModel: g.model,
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
      onSave?.(saved.id);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    },
  });

  const canSave =
    title.trim().length > 0 &&
    !!personaModelKey &&
    !!graderModelKey &&
    !saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Drama className="h-5 w-5" />
            {isEdit ? "Edit Roleplay" : "New Roleplay"}
          </DialogTitle>
        </DialogHeader>

        {isEdit && isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="scenario" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="scenario">Scenario</TabsTrigger>
              <TabsTrigger value="persona">Persona</TabsTrigger>
              <TabsTrigger value="rubric">Rubric</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4 pr-3">
              {/* Scenario */}
              <TabsContent value="scenario" className="space-y-4 mt-0">
                <Field label="Title" required>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Handling an angry customer" />
                </Field>
                <Field label="Short description">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </Field>
                <Field label="Introduction (shown before the learner starts)">
                  <Textarea value={introduction} onChange={(e) => setIntroduction(e.target.value)} rows={3} />
                </Field>
                <Field label="Learner's role">
                  <Input value={learnerRole} onChange={(e) => setLearnerRole(e.target.value)} placeholder="e.g. Customer Support Agent" />
                </Field>
                <Field label="Situation / context">
                  <Textarea value={situationContext} onChange={(e) => setSituationContext(e.target.value)} rows={3} placeholder="Describe the scenario setup the persona is reacting to." />
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
            </ScrollArea>
          </Tabs>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" disabled={!canSave} onClick={() => saveMutation.mutate("draft")}>
            Save draft
          </Button>
          <Button disabled={!canSave} onClick={() => saveMutation.mutate("published")}>
            {saveMutation.isPending ? "Saving…" : "Save & publish"}
          </Button>
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
