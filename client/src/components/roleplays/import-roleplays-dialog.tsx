import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  importScenariosZips,
  parseScenarioFiles,
  type ParsedZipItem,
} from "@/lib/roleplay-transfer";
import { Loader2, Upload } from "lucide-react";

interface ImportRoleplaysDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const reset = () => {
    setItems([]);
    setSelectedKeys(new Set());
    setFileErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setParsing(true);
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

  const importMutation = useMutation({
    mutationFn: async () => {
      const files = items
        .filter((i) => selectedKeys.has(i.key))
        .map((i) => i.file);
      return importScenariosZips(files);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
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

  const selectedCount = selectedKeys.size;
  const canImport = selectedCount > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
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
            disabled={!canImport || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing…
              </>
            ) : (
              `Import ${selectedCount || ""}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
