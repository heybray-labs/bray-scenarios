import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import { Button } from "@heybray/ui/components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@heybray/ui/components/tabs";
import { useAuth } from "../hooks/use-auth.ts";
import { Settings } from "lucide-react";

export interface SettingsPanel {
  value: string;
  label: string;
  /** Hidden unless the user has the manage permission. */
  requiresManage?: boolean;
  /**
   * Render the panel body. `onDirtyChange` lets a panel report unsaved changes
   * so the modal can guard against accidental close.
   */
  render: (ctx: { open: boolean; onDirtyChange: (dirty: boolean) => void }) => ReactNode;
}

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panels: SettingsPanel[];
  /** Permission required to see `requiresManage` panels. */
  managePermission?: string;
}

export function SettingsModal({
  open,
  onOpenChange,
  panels,
  managePermission = "roleplay:manage",
}: SettingsModalProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(managePermission);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const visiblePanels = panels.filter((p) => !p.requiresManage || canManage);

  const requestClose = (next: boolean) => {
    if (!next && dirty) {
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

        <Tabs
          defaultValue={visiblePanels[0]?.value}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <TabsList className="shrink-0">
            {visiblePanels.map((panel) => (
              <TabsTrigger key={panel.value} value={panel.value}>
                {panel.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            {visiblePanels.map((panel) => (
              <TabsContent
                key={panel.value}
                value={panel.value}
                className="mt-0 h-full overflow-y-auto pr-1"
              >
                {panel.render({ open, onDirtyChange: setDirty })}
              </TabsContent>
            ))}
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
                setDirty(false);
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
