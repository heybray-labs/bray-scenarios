import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Label } from "@heybray/ui/components/label";
import { Input } from "@heybray/ui/components/input";
import { Button } from "@heybray/ui/components/button";
import { Badge } from "@heybray/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heybray/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@heybray/ui/components/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { apiRequest, queryClient } from "@heybray/react/lib/queryClient";
import { Loader2, Plus, RefreshCw, TestTube2, Trash2, X } from "lucide-react";
import {
  type AgentProvider,
  type AgentModelOption,
  type ModelRef,
  type RoleplayFullConfig,
  PROVIDERS,
  PROVIDER_LABELS,
  modelKey,
  formatModelLabel,
  modelsEqual,
  hasKeyFor,
} from "./roleplay-config/setup-status";

type ModelCatalogResponse = {
  provider: AgentProvider;
  models: AgentModelOption[];
};

type ProviderKeyDraft = {
  value: string;
  hadSavedKey: boolean;
};

function ModelPicker({
  allowedModels,
  visibleProviders,
  keys,
  catalogApiKeys,
  catalogGeneration,
  base,
  onAdd,
  onRemove,
}: {
  allowedModels: ModelRef[];
  visibleProviders: AgentProvider[];
  keys: RoleplayFullConfig["keys"];
  /** Verified draft keys to use instead of saved credentials when listing models. */
  catalogApiKeys: Partial<Record<AgentProvider, string>>;
  /** Bumped after a successful key test so the catalog refetches without caching the key. */
  catalogGeneration: number;
  base: string;
  onAdd: (ref: ModelRef) => void;
  onRemove: (key: string) => void;
}) {
  const configuredProviders = visibleProviders;
  const firstProvider = configuredProviders[0] ?? PROVIDERS[0];
  const [activeProvider, setActiveProvider] = useState<AgentProvider>(firstProvider);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!configuredProviders.includes(activeProvider) && configuredProviders.length) {
      setActiveProvider(configuredProviders[0]);
    }
  }, [activeProvider, configuredProviders]);

  const hasKeyForProvider = hasKeyFor(keys, activeProvider);
  const draftApiKey = catalogApiKeys[activeProvider];
  const usesDraftKey = Boolean(draftApiKey);

  const { data: catalog, isLoading: catalogLoading } = useQuery<ModelCatalogResponse>({
    queryKey: [
      `${base}/model-catalog`,
      activeProvider,
      refreshToken,
      catalogGeneration,
      usesDraftKey ? "draft" : "saved",
    ],
    queryFn: async () =>
      apiRequest("POST", `${base}/model-catalog`, {
        provider: activeProvider,
        refresh: refreshToken > 0,
        ...(draftApiKey ? { apiKey: draftApiKey } : {}),
      }) as Promise<ModelCatalogResponse>,
    enabled: hasKeyForProvider,
    staleTime: 60 * 60 * 1000,
  });

  const availableModels = (catalog?.models ?? []).filter(
    (m) => !allowedModels.some((x) => x.provider === activeProvider && x.model === m.id),
  );

  if (configuredProviders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a provider above to load models from its API.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[2rem]">
        {allowedModels.length === 0 ? (
          <span className="text-sm text-muted-foreground">No models selected</span>
        ) : (
          allowedModels.map((m) => (
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
            {configuredProviders.map((p) => (
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
            disabled={!hasKeyForProvider || catalogLoading}
            onClick={() => setRefreshToken((n) => n + 1)}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${catalogLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {configuredProviders.map((p) => (
          <TabsContent key={p} value={p} className="mt-3 space-y-2">
            {!hasKeyFor(keys, p) && p === activeProvider && (
              <p className="text-xs text-muted-foreground">
                Enter and test an API key for {PROVIDER_LABELS[p]} to load models from the
                provider API.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Add model</Label>
              <Select
                disabled={
                  !hasKeyFor(keys, p) || catalogLoading || availableModels.length === 0
                }
                onValueChange={(modelId) => onAdd({ provider: activeProvider, model: modelId })}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      !hasKeyFor(keys, p)
                        ? "Test API key to load models"
                        : catalogLoading
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

export function RoleplayConfigPanel({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { toast } = useToast();
  const base = `/api/roleplay-config`;

  const [providerDrafts, setProviderDrafts] = useState<
    Partial<Record<AgentProvider, ProviderKeyDraft>>
  >({});
  /** Provider → draft key string that passed a successful test (enables model catalog before save). */
  const [verifiedDraftKeys, setVerifiedDraftKeys] = useState<
    Partial<Record<AgentProvider, string>>
  >({});
  const [catalogGeneration, setCatalogGeneration] = useState(0);
  const [visibleProviders, setVisibleProviders] = useState<AgentProvider[]>([]);
  const [removeProviders, setRemoveProviders] = useState<AgentProvider[]>([]);
  const [allowedModels, setAllowedModels] = useState<ModelRef[]>([]);
  const [pendingRemoveProvider, setPendingRemoveProvider] = useState<AgentProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<AgentProvider | null>(null);

  const { data, isLoading, refetch } = useQuery<RoleplayFullConfig>({
    queryKey: [base],
    queryFn: async () => apiRequest("GET", base) as Promise<RoleplayFullConfig>,
  });

  useEffect(() => {
    if (!data) return;
    setAllowedModels(data.allowedModels ?? []);
    setRemoveProviders([]);
    setVerifiedDraftKeys({});
    setCatalogGeneration(0);
    const configured = data.keys.filter((k) => k.hasKey).map((k) => k.provider);
    setVisibleProviders(configured);
    setProviderDrafts(
      Object.fromEntries(
        configured.map((p) => [p, { value: "", hadSavedKey: true }]),
      ) as Partial<Record<AgentProvider, ProviderKeyDraft>>,
    );
  }, [data]);

  const isDirty = useMemo(() => {
    if (!data) return false;
    if (!modelsEqual(allowedModels, data.allowedModels ?? [])) return true;
    if (removeProviders.length > 0) return true;

    for (const p of visibleProviders) {
      if (providerDrafts[p]?.value.trim()) return true;
    }

    const savedProviders = data.keys
      .filter((k) => k.hasKey)
      .map((k) => k.provider)
      .sort()
      .join(",");
    const currentVisible = [...visibleProviders].sort().join(",");
    if (savedProviders !== currentVisible) return true;

    return false;
  }, [data, allowedModels, removeProviders, visibleProviders, providerDrafts]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const keys: Partial<Record<AgentProvider, string>> = {};
      for (const p of visibleProviders) {
        const draft = providerDrafts[p]?.value.trim();
        if (draft) keys[p] = draft;
      }
      const modelsAfterRemoval = allowedModels.filter(
        (m) => !removeProviders.includes(m.provider),
      );
      return apiRequest("PUT", base, {
        keys: Object.keys(keys).length ? keys : undefined,
        removeProviders: removeProviders.length ? removeProviders : undefined,
        models: modelsAfterRemoval,
      });
    },
    onSuccess: () => {
      toast({ title: "AI settings saved" });
      void queryClient.invalidateQueries({ queryKey: [`${base}/model-catalog`] });
      refetch();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const addableProviders = PROVIDERS.filter((p) => !visibleProviders.includes(p));

  const addProvider = (provider: AgentProvider) => {
    setVisibleProviders((prev) => [...prev, provider]);
    setProviderDrafts((prev) => ({
      ...prev,
      [provider]: { value: "", hadSavedKey: false },
    }));
    setRemoveProviders((prev) => prev.filter((p) => p !== provider));
  };

  const confirmRemoveProvider = (provider: AgentProvider) => {
    const modelsForProvider = allowedModels.filter((m) => m.provider === provider);
    if (modelsForProvider.length > 0) {
      setPendingRemoveProvider(provider);
      return;
    }
    removeProvider(provider);
  };

  const testProviderKey = async (provider: AgentProvider) => {
    const draft = providerDrafts[provider]?.value.trim();
    const saved =
      data && hasKeyFor(data.keys, provider) && !removeProviders.includes(provider);
    if (!draft && !saved) {
      toast({
        title: "No API key to test",
        description: "Enter an API key first.",
        variant: "destructive",
      });
      return;
    }

    setTestingProvider(provider);
    try {
      const body: { provider: AgentProvider; apiKey?: string } = { provider };
      if (draft) body.apiKey = draft;
      const result = (await apiRequest("POST", `${base}/test-key`, body)) as {
        success: boolean;
        error?: string;
      };
      if (result.success) {
        if (draft) {
          setVerifiedDraftKeys((prev) => ({ ...prev, [provider]: draft }));
        }
        setCatalogGeneration((n) => n + 1);
        toast({ title: `${PROVIDER_LABELS[provider]} key verified` });
      } else {
        toast({
          title: "Key test failed",
          description: result.error ?? "Could not verify API key",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Key test failed",
        description: err instanceof Error ? err.message : "Could not verify API key",
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const removeProvider = (provider: AgentProvider) => {
    setVisibleProviders((prev) => prev.filter((p) => p !== provider));
    setProviderDrafts((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    setVerifiedDraftKeys((prev) => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
    if (data && hasKeyFor(data.keys, provider)) {
      setRemoveProviders((prev) => [...new Set([...prev, provider])]);
    }
    setAllowedModels((prev) => prev.filter((m) => m.provider !== provider));
    setPendingRemoveProvider(null);
  };

  const catalogApiKeys = useMemo(() => {
    const keys: Partial<Record<AgentProvider, string>> = {};
    for (const p of PROVIDERS) {
      const draft = providerDrafts[p]?.value.trim() ?? "";
      if (verifiedDraftKeys[p] && verifiedDraftKeys[p] === draft) {
        keys[p] = draft;
      }
    }
    return keys;
  }, [providerDrafts, verifiedDraftKeys]);

  const effectiveKeys = useMemo((): RoleplayFullConfig["keys"] => {
    if (!data) {
      return PROVIDERS.map((provider) => ({
        provider,
        hasKey: Boolean(
          verifiedDraftKeys[provider] &&
            verifiedDraftKeys[provider] ===
              (providerDrafts[provider]?.value.trim() ?? ""),
        ),
      }));
    }
    return PROVIDERS.map((provider) => {
      const draft = providerDrafts[provider]?.value.trim() ?? "";
      const draftVerified =
        Boolean(verifiedDraftKeys[provider]) &&
        verifiedDraftKeys[provider] === draft;
      const saved =
        hasKeyFor(data.keys, provider) && !removeProviders.includes(provider);
      return {
        provider,
        hasKey: saved || draftVerified,
      };
    });
  }, [data, removeProviders, providerDrafts, verifiedDraftKeys]);

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-8 pb-20">
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <>
            <section className="space-y-4">
              <div>
                <h3 className="font-medium">Connect providers</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add the LLM vendors you use.
                </p>
              </div>

              {visibleProviders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No providers added yet.</p>
              ) : (
                <div className="space-y-3">
                  {visibleProviders.map((p) => {
                    const draft = providerDrafts[p];
                    const saved =
                      data && hasKeyFor(data.keys, p) && !removeProviders.includes(p);
                    const showConfigured = saved && !draft?.value.trim();
                    return (
                      <div key={p} className="flex items-center gap-2">
                        <span className="w-36 shrink-0 truncate text-sm font-medium">
                          {PROVIDER_LABELS[p]}
                        </span>
                        <Input
                          type="password"
                          className="flex-1"
                          value={draft?.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProviderDrafts((prev) => ({
                              ...prev,
                              [p]: {
                                value,
                                hadSavedKey: prev[p]?.hadSavedKey ?? saved ?? false,
                              },
                            }));
                            setVerifiedDraftKeys((prev) => {
                              if (prev[p] === undefined) return prev;
                              if (prev[p] === value.trim()) return prev;
                              const next = { ...prev };
                              delete next[p];
                              return next;
                            });
                          }}
                          placeholder={showConfigured ? "••••••••••••" : "Enter API key"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          disabled={testingProvider === p || (!saved && !draft?.value.trim())}
                          onClick={() => void testProviderKey(p)}
                          aria-label={`Test ${PROVIDER_LABELS[p]} API key`}
                        >
                          {testingProvider === p ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <TestTube2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => confirmRemoveProvider(p)}
                          aria-label={`Remove ${PROVIDER_LABELS[p]}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {addableProviders.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add provider
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {addableProviders.map((p) => (
                      <DropdownMenuItem key={p} onClick={() => addProvider(p)}>
                        {PROVIDER_LABELS[p]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </section>

            <section className="space-y-4">
              <div>
                <h3 className="font-medium">Allowed models</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Models authors can choose when building a roleplay (for both conversation
                  and grading).
                </p>
              </div>

              <ModelPicker
                allowedModels={allowedModels}
                visibleProviders={visibleProviders}
                keys={effectiveKeys}
                catalogApiKeys={catalogApiKeys}
                catalogGeneration={catalogGeneration}
                base={base}
                onAdd={(ref) => {
                  if (allowedModels.some((m) => modelKey(m) === modelKey(ref))) return;
                  setAllowedModels((prev) => [...prev, ref]);
                }}
                onRemove={(key) =>
                  setAllowedModels((prev) => prev.filter((m) => modelKey(m) !== key))
                }
              />
            </section>
          </>
        )}
      </div>

      {!isLoading && (
        <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex justify-end">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={pendingRemoveProvider !== null}
        onOpenChange={(open) => !open && setPendingRemoveProvider(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove provider?</DialogTitle>
            <DialogDescription>
              {pendingRemoveProvider &&
                `Removing ${PROVIDER_LABELS[pendingRemoveProvider]} will also remove its allowed models. Save changes to apply.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemoveProvider(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pendingRemoveProvider && removeProvider(pendingRemoveProvider)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
