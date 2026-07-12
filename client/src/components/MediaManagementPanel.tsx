import { useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@heybray/ui/components/button";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import {
  formatBytes,
  type MediaAssetDto,
  uploadMediaFile,
} from "@/lib/media";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

export function MediaManagementPanel() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: assets = [], isLoading } = useQuery<MediaAssetDto[]>({
    queryKey: ["/api/media"],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/media/${id}`),
    onSuccess: (result: { detachedFromScenarios?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
      const n = result?.detachedFromScenarios ?? 0;
      toast({
        title: "Image deleted",
        description:
          n > 0
            ? `Detached from ${n} scenario${n === 1 ? "" : "s"}.`
            : undefined,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadMediaFile(file);
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = (asset: MediaAssetDto) => {
    const uses = asset.usageCount ?? 0;
    const message =
      uses > 0
        ? `Delete "${asset.originalFilename}"? It will be detached from ${uses} scenario${uses === 1 ? "" : "s"}.`
        : `Delete "${asset.originalFilename}"?`;
    if (!window.confirm(message)) return;
    deleteMutation.mutate(asset.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Media library</p>
          <p className="text-xs text-muted-foreground">
            Cover images for scenarios. JPEG, PNG, or WebP · max 500 KB.
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            Upload
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No images yet. Upload a cover image to get started.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-lg border overflow-hidden">
              <ScenarioCover mediaId={asset.id} />
              <div className="p-2 space-y-2">
                <div>
                  <p className="text-xs font-medium truncate" title={asset.originalFilename}>
                    {asset.originalFilename}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatBytes(asset.sizeBytes)}
                    {asset.usageCount != null
                      ? ` · used by ${asset.usageCount} scenario${asset.usageCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(asset)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
