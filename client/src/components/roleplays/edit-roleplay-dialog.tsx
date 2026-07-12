import RoleplayBuilderDialog from "./RoleplayBuilderDialog";
import { queryClient } from "@heybray/react/lib/queryClient";

interface EditRoleplayDialogProps {
  roleplayId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditRoleplayDialog({
  roleplayId,
  open,
  onOpenChange,
}: EditRoleplayDialogProps) {
  const handleSave = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/roleplays"] });
    queryClient.invalidateQueries({ queryKey: [`/api/roleplays/${roleplayId}`] });
    onOpenChange(false);
  };

  return (
    <RoleplayBuilderDialog
      roleplayId={roleplayId}
      open={open}
      onOpenChange={onOpenChange}
      onSave={handleSave}
    />
  );
}
