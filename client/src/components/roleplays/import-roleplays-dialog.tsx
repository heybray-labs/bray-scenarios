import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { Button } from "@heybray/ui/components/button";
import { Alert, AlertDescription } from "@heybray/ui/components/alert";
import { ScrollArea } from "@heybray/ui/components/scroll-area";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  importScenariosZips,
  parseScenarioFiles,
  previewScenarioImports,
  type MissingImportClassification,
  type ParsedZipItem,
} from "@/lib/roleplay-transfer";
import { Loader2, Upload } from "lucide-react";

interface ImportRoleplaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PROMPT_DIMENSION_ORDER = ["category", "audience_level", "duration"] as const;

function groupMissingByDimension(missing: MissingImportClassification[]) {
  const groups = new Map<string, MissingImportClassification[]>();
  for (const item of missing) {
    const list = groups.get(item.dimensionSlug) ?? [];
    list.push(item);
    groups.set(item.dimensionSlug, list);
  }
  return PROMPT_DIMENSION_ORDER.filter((slug) => groups.has(slug)).map((slug) => {
    const values = groups.get(slug) ?? [];
    return [values[0]?.dimensionName ?? slug, values] as const;
  });
}

export default function ImportRoleplaysDialog({
  open,
  onOpenChange,
}: ImportRoleplaysDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ParsedZipItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<{ fileName: string; message: string }[]>([]);
  const [parsing, setParsing] = useState(false);
  const [missingClassifications, setMissingClassifications] = useState<
    MissingImportClassification[] | null
  >(null);
  const [autoImportTagCount, setAutoImportTagCount] = useState(0);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const reset = () => {
    setItems([]);
    setSelectedKeys(new Set());
    setFileErrors([]);
    setMissingClassifications(null);
    setAutoImportTagCount(0);
    setPreviewError(null);
    setPreviewing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setParsing(true);
    setMissingClassifications(null);
    setPreviewError(null);
    try {
      const result = await parseScenarioFiles(files);
      setItems(result.items);
      setSelectedKeys(new Set(result.items.map((i) => i.key)));
      setFileErrors(result.errors);
    } finally {
      setParsing(false);
    }
  };

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedKeys(checked ? new Set(items.map((i) => i.key)) : new Set());
  };

  const selectedFiles = () =>
    items.filter((item) => selectedKeys.has(item.key)).map((item) => item.file);

  const importMutation = useMutation({
    mutationFn: async (createMissingClassifications: boolean) => {
      const files = selectedFiles();
      return importScenariosZips(files, { createMissingClassifications });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplay-classifications"] });
      const count = result.created.length;
      const warnings = result.warnings ?? [];
      toast({
        title: count === 1 ? "Scenario imported" : `${count} scenarios imported`,
        description: warnings.length
          ? `Created as drafts. ${warnings.slice(0, 3).join(" ")}`
          : "Imported scenarios were created as drafts.",
      });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleImportClick = async () => {
    setPreviewError(null);
    setPreviewing(true);
    try {
      const preview = await previewScenarioImports(selectedFiles());
      setAutoImportTagCount(preview.autoImportTagCount);
      if (preview.missing.length > 0) {
        setMissingClassifications(preview.missing);
        return;
      }
      importMutation.mutate(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview failed";
      setPreviewError(message);
    } finally {
      setPreviewing(false);
    }
  };

  const selectedCount = selectedKeys.size;
  const canImport = selectedCount > 0;
  const showingMissingPrompt = missingClassifications != null && missingClassifications.length > 0;
  const missingGroups = showingMissingPrompt
    ? groupMissingByDimension(missingClassifications)
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {showingMissingPrompt ? (
          <>
            <DialogHeader>
              <DialogTitle>Add missing classifications?</DialogTitle>
              <DialogDescription>
                These category, audience level, and duration values are used in the
                selected scenario
                {selectedCount === 1 ? "" : "s"} but are not in the app yet. Add them
                before importing?
                {autoImportTagCount > 0 && (
                  <>
                    {" "}
                    Missing tags ({autoImportTagCount}) will be added automatically.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-64 rounded-md border">
              <div className="p-3 space-y-4">
                {missingGroups.map(([dimensionName, values]) => (
                  <div key={dimensionName}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                      {dimensionName}
                    </p>
                    <ul className="space-y-1">
                      {values.map((value) => (
                        <li
                          key={`${value.dimensionSlug}:${value.slug}`}
                          className="text-sm flex items-baseline justify-between gap-3"
                        >
                          <span className="font-medium">{value.suggestedLabel}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {value.slug}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setMissingClassifications(null)}
                disabled={importMutation.isPending}
              >
                Back
              </Button>
              <Button
                variant="outline"
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(false)}
              >
                Import without adding
              </Button>
              <Button
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(true)}
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Add & import"
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Import scenarios</DialogTitle>
              <DialogDescription>
                Choose one or more scenario zip packages (includes cover images).
                Imported scenarios are always created as drafts.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                multiple
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                disabled={parsing}
                onClick={() => fileInputRef.current?.click()}
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {items.length ? "Choose different files" : "Choose zip files"}
              </Button>

              {previewError && (
                <Alert variant="destructive">
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {fileErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1 text-sm">
                      {fileErrors.map((err) => (
                        <li key={`${err.fileName}-${err.message}`}>
                          <span className="font-medium">{err.fileName}</span>: {err.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {items.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={selectedCount === items.length && items.length > 0}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                      Select all ({items.length})
                    </label>
                    <span className="text-muted-foreground">{selectedCount} selected</span>
                  </div>
                  <ScrollArea className="h-48 rounded-md border">
                    <ul className="p-2 space-y-1">
                      {items.map((item) => (
                        <li key={item.key}>
                          <label className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-input"
                              checked={selectedKeys.has(item.key)}
                              onChange={() => toggleKey(item.key)}
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium truncate">
                                {item.title}
                              </span>
                              <span className="block text-xs text-muted-foreground truncate">
                                {item.sourceFile}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                disabled={!canImport || importMutation.isPending || previewing}
                onClick={() => void handleImportClick()}
              >
                {importMutation.isPending || previewing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {previewing ? "Checking…" : "Importing…"}
                  </>
                ) : (
                  `Import ${selectedCount || ""}`.trim()
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
