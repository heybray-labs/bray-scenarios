import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleplayConfigPanel } from "@/components/RoleplayConfigPanel";
import { UsersManagementPanel } from "@/components/UsersManagementPanel";
import { Settings } from "lucide-react";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] min-h-[85vh] max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden">
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
          </TabsList>

          <div className="mt-4 min-h-0 flex-1 overflow-hidden">
            <TabsContent value="ai" className="mt-0 h-full overflow-y-auto pr-1">
              <RoleplayConfigPanel />
            </TabsContent>

            <TabsContent value="users" className="mt-0 h-full overflow-y-auto pr-1">
              <UsersManagementPanel />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
