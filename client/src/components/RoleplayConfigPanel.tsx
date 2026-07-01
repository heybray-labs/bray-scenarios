import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Drama, Loader2, RefreshCw, X, Circle, CheckCircle } from "lucide-react";
import {
  type AgentProvider,
  type AgentModelOption,
  type ModelRef,
  type RoleplayFullConfig,
  PROVIDERS,
  PROVIDER_LABELS,
  modelKey,
  formatModelLabel,
  getSetupChecklist,
  allowlistsEqual,
} from "./roleplay-config/setup-status";

type ModelCatalogResponse = {
  provider: AgentProvider;
  models: AgentModelOption[];
};

function SetupOverview({
  config,
  isReady,
}: {
  config: RoleplayFullConfig;
  isReady: boolean;
}) {
  const checklist = getSetupChecklist(config);

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Keys unlock providers → allowlists define what authors can pick → each roleplay
          requires its own persona and grader models.
        </p>
        {isReady ? (
          <Badge variant="default">Ready</Badge>
        ) : (
          <Badge variant="secondary">Not configured</Badge>
        )}
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            {item.complete ? (
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
              {!item.complete && item.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({
  step,
  title,
  description,
  unsaved,
  action,
}: {
  step: number;
  title: string;
  description?: string;
  unsaved?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h3 className="font-medium text-sm flex items-center gap-2">
          <span className="text-muted-foreground">{step}.</span>
          {title}
          {unsaved && (
            <Badge variant="outline" className="text-[10px] font-normal">
              Unsaved changes
            </Badge>
          )}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function AllowlistCard({
  purpose,
  title,
  description,
  hint,
  list,
  keys,
  base,
  onAdd,
  onRemove,
}: {
  purpose: "persona" | "grader";
  title: string;
  description: string;
  hint?: string;
  list: ModelRef[];
  keys: RoleplayFullConfig["keys"];
  base: string;
  onAdd: (ref: ModelRef) => void;
  onRemove: (key: string) => void;
}) {
  const [activeProvider, setActiveProvider] = useState<AgentProvider>("openai");
  const [refreshToken, setRefreshToken] = useState(0);

  const { data: catalog, isLoading: catalogLoading, refetch } = useQuery<ModelCatalogResponse>({
    queryKey: [`${base}/model-catalog`, purpose, activeProvider, refreshToken],
    queryFn: async () => {
      const refresh = refreshToken > 0 ? "&refresh=true" : "";
      return apiRequest(
        "GET",
        `${base}/model-catalog?provider=${activeProvider}${refresh}`,
      ) as Promise<ModelCatalogResponse>;
    },
    staleTime: 60 * 60 * 1000,
  });

  const hasKeyForProvider = keys.find((k) => k.provider === activeProvider)?.hasKey ?? false;
  const availableModels = (catalog?.models ?? []).filter(
    (m) => !list.some((x) => x.provider === activeProvider && x.model === m.id),
  );

  return (
    <div className="rounded-lg border p-4 space-y-3 flex-1 min-w-0">
      <div>
        <h4 className="font-medium text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
        {list.length === 0 && hint && (
          <p className="text-xs text-muted-foreground mt-2 italic">{hint}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {list.length === 0 ? (
          <span className="text-xs text-muted-foreground">No models selected</span>
        ) : (
          list.map((m) => (
            <Badge key={modelKey(m)} variant="secondary" className="gap-1 pr-1">
              {formatModelLabel(m)}
              <button
                type="button"
                className="ml-1 rounded hover:bg-muted"
                onClick={() => onRemove(modelKey(m))}
                aria-label={`Remove ${formatModelLabel(m)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <Tabs
        value={activeProvider}
        onValueChange={(v) => setActiveProvider(v as AgentProvider)}
      >
        <div className="flex items-center justify-between gap-2">
          <TabsList className="h-auto gap-2 border-0">
            {PROVIDERS.map((p) => (
              <TabsTrigger key={p} value={p} className="text-xs px-2 py-1">
                {PROVIDER_LABELS[p]}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 shrink-0"
            disabled={catalogLoading}
            onClick={() => {
              setRefreshToken((n) => n + 1);
              void refetch();
            }}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${catalogLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {PROVIDERS.map((p) => (
          <TabsContent key={p} value={p} className="mt-3 space-y-2">
            {!hasKeyForProvider && p === activeProvider && (
              <p className="text-xs text-muted-foreground">
                Save an API key for {PROVIDER_LABELS[p]} in section 1, then refresh the catalog.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Add from catalog</Label>
              <Select
                onValueChange={(modelId) =>
                  onAdd({ provider: activeProvider, model: modelId })
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      catalogLoading
                        ? "Loading…"
                        : availableModels.length === 0
                          ? "No models available"
                          : "Pick a model"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export function RoleplayConfigPanel() {
  const { toast } = useToast();
  const base = `/api/roleplay-config`;

  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [googleKey, setGoogleKey] = useState("");
  const [personaAllowlist, setPersonaAllowlist] = useState<ModelRef[]>([]);
  const [graderAllowlist, setGraderAllowlist] = useState<ModelRef[]>([]);

  const { data, isLoading, refetch } = useQuery<RoleplayFullConfig>({
    queryKey: [base],
    queryFn: async () => apiRequest("GET", base) as Promise<RoleplayFullConfig>,
  });

  useEffect(() => {
    if (!data) return;
    setPersonaAllowlist(data.personaAllowlist ?? []);
    setGraderAllowlist(data.graderAllowlist ?? []);
  }, [data]);

  const keysDirty = !!(openaiKey || anthropicKey || googleKey);
  const allowlistsDirty = useMemo(() => {
    if (!data) return false;
    return (
      !allowlistsEqual(personaAllowlist, data.personaAllowlist ?? []) ||
      !allowlistsEqual(graderAllowlist, data.graderAllowlist ?? [])
    );
  }, [data, personaAllowlist, graderAllowlist]);

  const checklistConfig = useMemo((): RoleplayFullConfig | null => {
    if (!data) return null;
    return {
      keys: data.keys,
      personaAllowlist,
      graderAllowlist,
      isReady: data.isReady,
    };
  }, [data, personaAllowlist, graderAllowlist]);

  const keysMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (openaiKey.trim()) body.openai = openaiKey.trim();
      if (anthropicKey.trim()) body.anthropic = anthropicKey.trim();
      if (googleKey.trim()) body.google = googleKey.trim();
      return apiRequest("PUT", `${base}/keys`, body);
    },
    onSuccess: () => {
      toast({ title: "API keys saved" });
      setOpenaiKey("");
      setAnthropicKey("");
      setGoogleKey("");
      refetch();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to save keys", description: err.message, variant: "destructive" }),
  });

  const allowlistsMutation = useMutation({
    mutationFn: async () =>
      apiRequest("PUT", `${base}/allowlists`, {
        persona: personaAllowlist,
        grader: graderAllowlist,
      }),
    onSuccess: () => {
      toast({ title: "Model allowlists saved" });
      refetch();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to save allowlists", description: err.message, variant: "destructive" }),
  });

  const addToAllowlist = (purpose: "persona" | "grader", ref: ModelRef) => {
    const list = purpose === "persona" ? personaAllowlist : graderAllowlist;
    const setter = purpose === "persona" ? setPersonaAllowlist : setGraderAllowlist;
    if (list.some((m) => modelKey(m) === modelKey(ref))) return;
    setter([...list, ref]);
  };

  const removeFromAllowlist = (purpose: "persona" | "grader", key: string) => {
    const setter = purpose === "persona" ? setPersonaAllowlist : setGraderAllowlist;
    setter((prev) => prev.filter((m) => modelKey(m) !== key));
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Drama className="h-5 w-5" />
            Roleplay AI
          </CardTitle>
          <CardDescription>
            Set up provider API keys and model allowlists. Authors choose persona and grader
            models when creating each roleplay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              {checklistConfig && (
                <SetupOverview config={checklistConfig} isReady={data?.isReady ?? false} />
              )}

              <section className="space-y-4 rounded-lg border p-4">
                <SectionHeader
                  step={1}
                  title="Provider API keys"
                  description="Required for every provider used in your model allowlists."
                  unsaved={keysDirty}
                />
                <div className="space-y-3">
                  {PROVIDERS.map((p) => {
                    const hasKey = data?.keys.find((k) => k.provider === p)?.hasKey;
                    const value =
                      p === "openai" ? openaiKey : p === "anthropic" ? anthropicKey : googleKey;
                    const setValue =
                      p === "openai"
                        ? setOpenaiKey
                        : p === "anthropic"
                          ? setAnthropicKey
                          : setGoogleKey;
                    return (
                      <div key={p} className="space-y-1">
                        <Label className="text-xs flex items-center gap-2">
                          {PROVIDER_LABELS[p]}
                          <Badge
                            variant={hasKey ? "outline" : "secondary"}
                            className="text-[10px]"
                          >
                            {hasKey ? "Configured" : "Not set"}
                          </Badge>
                        </Label>
                        <Input
                          type="password"
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={hasKey ? "Leave blank to keep current" : "Enter API key"}
                        />
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  onClick={() => keysMutation.mutate()}
                  disabled={keysMutation.isPending || !keysDirty}
                >
                  {keysMutation.isPending ? "Saving…" : "Save API keys"}
                </Button>
              </section>

              <section className="space-y-4 rounded-lg border p-4">
                <SectionHeader
                  step={2}
                  title="Model allowlists"
                  description="Choose which models roleplay authors can select per scenario."
                  unsaved={allowlistsDirty}
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => allowlistsMutation.mutate()}
                      disabled={allowlistsMutation.isPending || !allowlistsDirty}
                    >
                      {allowlistsMutation.isPending ? "Saving…" : "Save allowlists"}
                    </Button>
                  }
                />
                <div className="flex flex-col lg:flex-row gap-4">
                  <AllowlistCard
                    purpose="persona"
                    title="Persona (conversation)"
                    description="Chat models for in-character dialogue."
                    hint="Tip: start with a fast chat model such as GPT-4o mini or Claude Sonnet."
                    list={personaAllowlist}
                    keys={data?.keys ?? []}
                    base={base}
                    onAdd={(ref) => addToAllowlist("persona", ref)}
                    onRemove={(key) => removeFromAllowlist("persona", key)}
                  />
                  <AllowlistCard
                    purpose="grader"
                    title="Grader (rubric scoring)"
                    description="Reasoning models for scoring attempts with fixed temperature."
                    hint="Tip: reasoning models (o-series, GPT-5) work well for rubric grading."
                    list={graderAllowlist}
                    keys={data?.keys ?? []}
                    base={base}
                    onAdd={(ref) => addToAllowlist("grader", ref)}
                    onRemove={(key) => removeFromAllowlist("grader", key)}
                  />
                </div>
              </section>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
