import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@heybray/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { ScenarioCover } from "@/components/roleplays/ScenarioCover";
import {
  formatBytes,
  type MediaAssetDto,
  uploadMediaFile,
} from "@heybray/react/lib/media";
import { queryClient } from "@heybray/react/lib/queryClient";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { ImagePlus, Library, Loader2, X } from "lucide-react";

type CoverImagePickerProps = {
  mediaId: number | null;
  onChange: (mediaId: number | null) => void;
};

export function CoverImagePicker({ mediaId, onChange }: CoverImagePickerProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const { data: assets = [], isLoading: libraryLoading } = useQuery<MediaAssetDto[]>({
    queryKey: ["/api/media"],
    enabled: libraryOpen,
  });

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadMediaFile(file);
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      onChange(asset.id);
      toast({ title: "Cover image uploaded" });
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

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border max-w-md">
        <ScenarioCover mediaId={mediaId} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => void handleUpload(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLibraryOpen(true)}
        >
          <Library className="h-4 w-4 mr-2" />
          Choose from library
        </Button>
        {mediaId != null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, or WebP · max 500 KB · shown at 16:9 on cards and summary pages
      </p>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose cover image</DialogTitle>
          </DialogHeader>
          {libraryLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : assets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No images in the library yet. Upload one first.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={`rounded-lg border overflow-hidden text-left hover:ring-2 hover:ring-primary transition ${
                    mediaId === asset.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    onChange(asset.id);
                    setLibraryOpen(false);
                  }}
                >
                  <ScenarioCover mediaId={asset.id} />
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{asset.originalFilename}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatBytes(asset.sizeBytes)}
                      {asset.usageCount != null ? ` · ${asset.usageCount} uses` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
