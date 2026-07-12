import { useEffect, useState } from "react";
import { mediaUrl } from "../lib/media.ts";

/**
 * Fetches an authenticated media asset and returns a blob URL for use in <img>.
 * Cleans up the blob URL on unmount or when mediaId changes.
 */
export function useAuthenticatedImage(mediaId: number | null | undefined): {
  src: string | null;
  isLoading: boolean;
  error: boolean;
} {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (mediaId == null) {
      setSrc(null);
      setIsLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setError(false);
    setSrc(null);

    const token = localStorage.getItem("auth_token");
    fetch(mediaUrl(mediaId), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load image");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return { src, isLoading, error };
}
