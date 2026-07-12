import { Router, type Request, type RequestHandler, Response } from "express";
import multer from "multer";
import {
  mediaService,
  MediaValidationError,
  MediaNotFoundError,
  MEDIA_MAX_BYTES,
  mediaPublicUrl,
} from "./media.service.ts";
import { createLogger } from "../logger.ts";

const platformLogger = createLogger("media");

/**
 * Auth guards injected by the app. server-kit owns media but not auth (identity
 * depends on server-kit, so it cannot depend back on identity); the app wires
 * identity's middleware in when constructing the router.
 */
export interface MediaRouteGuards {
  authenticateToken: RequestHandler;
  requirePasswordChanged: RequestHandler;
  requireManage: RequestHandler;
}

/** Minimal authenticated-request shape read by the media routes. */
interface AuthedRequest extends Request {
  user?: { id: number };
}

export function createMediaRouter(guards: MediaRouteGuards): Router {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MEDIA_MAX_BYTES, files: 1 },
  });

  const router = Router();

  router.use(guards.authenticateToken);
  router.use(guards.requirePasswordChanged);

  router.get("/", guards.requireManage, async (_req: AuthedRequest, res: Response) => {
    try {
      const assets = await mediaService.listWithUsage();
      res.json(
        assets.map((a) => ({
          ...a,
          url: mediaPublicUrl(a.id),
        })),
      );
    } catch (error) {
      platformLogger.error("list media error", error instanceof Error ? error : undefined);
      res.status(500).json({ error: "Failed to list media" });
    }
  });

  router.post(
    "/",
    guards.requireManage,
    (req: AuthedRequest, res: Response, next) => {
      upload.single("file")(req, res, (err) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              error: `Image must be at most ${MEDIA_MAX_BYTES / 1024} KB.`,
            });
          }
          return res.status(400).json({ error: err.message });
        }
        if (err) return next(err);
        next();
      });
    },
    async (req: AuthedRequest, res: Response) => {
      try {
        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "File is required (field name: file)" });
        }
        const asset = await mediaService.createFromBuffer(file.buffer, {
          originalFilename: file.originalname || "image",
          mimeType: file.mimetype,
          createdBy: req.user!.id,
        });
        res.status(201).json({
          ...asset,
          url: mediaPublicUrl(asset.id),
        });
      } catch (error) {
        if (error instanceof MediaValidationError) {
          return res.status(400).json({ error: error.message });
        }
        platformLogger.error("upload media error", error instanceof Error ? error : undefined);
        res.status(500).json({ error: "Failed to upload media" });
      }
    },
  );

  router.get("/:id", async (req: AuthedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid media id" });
      }
      const asset = await mediaService.getById(id);
      if (!asset) return res.status(404).json({ error: "Media not found" });

      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Content-Length", String(asset.sizeBytes));
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = mediaService.openReadStream(asset);
      stream.on("error", (err) => {
        platformLogger.error("media stream error", err instanceof Error ? err : undefined);
        if (!res.headersSent) {
          res.status(404).json({ error: "Media file missing" });
        } else {
          res.end();
        }
      });
      stream.pipe(res);
    } catch (error) {
      if (error instanceof MediaNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      platformLogger.error("serve media error", error instanceof Error ? error : undefined);
      res.status(500).json({ error: "Failed to serve media" });
    }
  });

  router.delete("/:id", guards.requireManage, async (req: AuthedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ error: "Invalid media id" });
      }
      const { usageCount } = await mediaService.delete(id);
      res.json({ message: "Deleted", detachedFromScenarios: usageCount });
    } catch (error) {
      if (error instanceof MediaNotFoundError) {
        return res.status(404).json({ error: error.message });
      }
      platformLogger.error("delete media error", error instanceof Error ? error : undefined);
      res.status(500).json({ error: "Failed to delete media" });
    }
  });

  return router;
}
