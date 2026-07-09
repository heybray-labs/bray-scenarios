import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleplayConfigPanel } from "@/components/RoleplayConfigPanel";
import { UsersManagementPanel } from "@/components/UsersManagementPanel";
import { MediaManagementPanel } from "@/components/MediaManagementPanel";
import { ClassificationManagementPanel } from "@/components/ClassificationManagementPanel";
import { FeaturedScenariosPanel } from "@/components/FeaturedScenariosPanel";
import { AboutPanel } from "@/components/AboutPanel";
import { useAuth } from "@/hooks/use-auth";
import { Settings } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("roleplay:manage");
  const [aiDirty, setAiDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const requestClose = (next: boolean) => {
    if (!next && aiDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent className="flex h-[70vh] min-h-[24rem] max-h-[70vh] w-full max-w-5xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="shrink-0">
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            {canManage && <TabsTrigger value="media">Media</TabsTrigger>}
            {canManage && <TabsTrigger value="classifications">Classifications</TabsTrigger>}
            {canManage && <TabsTrigger value="homepage">Homepage</TabsTrigger>}
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TabsContent value="ai" className="mt-0 h-full overflow-y-auto pr-1">
              <RoleplayConfigPanel
                key={open ? "open" : "closed"}
                onDirtyChange={setAiDirty}
              />
            </TabsContent>

            <TabsContent value="users" className="mt-0 h-full overflow-y-auto pr-1">
              <UsersManagementPanel />
            </TabsContent>

            {canManage && (
              <TabsContent value="media" className="mt-0 h-full overflow-y-auto pr-1">
                <MediaManagementPanel />
              </TabsContent>
            )}

            {canManage && (
              <TabsContent value="classifications" className="mt-0 h-full overflow-y-auto pr-1">
                <ClassificationManagementPanel />
              </TabsContent>
            )}

            {canManage && (
              <TabsContent value="homepage" className="mt-0 h-full overflow-y-auto pr-1">
                <FeaturedScenariosPanel />
              </TabsContent>
            )}

            <TabsContent value="about" className="mt-0 h-full overflow-y-auto pr-1">
              <AboutPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved AI settings. Close without saving?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false);
                setAiDirty(false);
                onOpenChange(false);
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
