import RoleplayBuilderDialog from "./RoleplayBuilderDialog";
import { queryClient } from "@/lib/queryClient";

interface CreateRoleplayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (roleplayId: number) => void;
}

export default function CreateRoleplayDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateRoleplayDialogProps) {
  const handleSave = (roleplayId: number) => {
    queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
    onCreated?.(roleplayId);
    onOpenChange(false);
  };

  return (
    <RoleplayBuilderDialog
      roleplayId={null}
      open={open}
      onOpenChange={onOpenChange}
      onSave={handleSave}
    />
  );
}
