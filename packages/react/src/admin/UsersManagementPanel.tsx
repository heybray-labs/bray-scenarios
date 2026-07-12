import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@heybray/ui/components/button";
import { Input } from "@heybray/ui/components/input";
import { Label } from "@heybray/ui/components/label";
import { Badge } from "@heybray/ui/components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@heybray/ui/components/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@heybray/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@heybray/ui/components/dropdown-menu";
import { useToast } from "@heybray/ui/hooks/use-toast";
import { useAuth } from "../hooks/use-auth.ts";
import { apiRequest, queryClient } from "../lib/queryClient.ts";
import { AuthService } from "../lib/auth.ts";
import type { UserSummary } from "@heybray/identity/schema";
import { Loader2, MoreVertical, Plus, Users } from "lucide-react";
import { HttpError } from "../lib/http-error.ts";

type UsersListResponse = {
  users: UserSummary[];
};

type PendingRoleChange = {
  userId: number;
  email: string;
  newRole: "admin" | "user";
};

const AVAILABLE_ROLES = ["admin", "user"] as const;

const USER_TABLE_GRID =
  "grid w-full grid-cols-[minmax(12rem,18rem)_7rem_auto_1fr_2.5rem] items-center gap-x-6 px-4";

export function UsersManagementPanel() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<PendingRoleChange | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "user">("user");

  useEffect(() => {
    AuthService.getAuthConfig()
      .then((config) => setSsoEnabled(config.sso.enabled))
      .catch(() => setSsoEnabled(false));
  }, []);

  const { data, isLoading, error } = useQuery<UsersListResponse>({
    queryKey: ["/api/users"],
  });

  const users = data?.users ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: {
      email: string;
      firstName?: string;
      password: string;
      role: "admin" | "user";
    }) => apiRequest("POST", "/api/users", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created", description: "They must change their password on first login." });
      setCreateOpen(false);
      setEmail("");
      setFirstName("");
      setPassword("");
      setCreateRole("user");
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to create user";
      toast({ title: "Could not create user", description: message, variant: "destructive" });
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "admin" | "user" }) =>
      apiRequest("PATCH", `/api/users/${userId}/role`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated" });
      setPendingRoleChange(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to update role";
      toast({ title: "Could not update role", description: message, variant: "destructive" });
      setPendingRoleChange(null);
    },
  });

  const handleRoleChange = (user: UserSummary, newRole: "admin" | "user") => {
    if (user.id === currentUser?.id) return;
    if (user.role.name === newRole) return;

    if (user.role.name === "admin" && newRole === "user") {
      setPendingRoleChange({
        userId: user.id,
        email: user.email,
        newRole,
      });
      return;
    }

    roleMutation.mutate({ userId: user.id, role: newRole });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      email,
      firstName: firstName.trim() || undefined,
      password,
      role: createRole,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Manage users in your organization. New users must change their password on first login.
        </p>
        {!ssoEnabled && (
          <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading users…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-4">Failed to load users.</p>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No users yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div
            className={`${USER_TABLE_GRID} border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground`}
          >
            <span>Email</span>
            <span>Name</span>
            <span>Role</span>
            <span />
            <span />
          </div>
          <ul className="divide-y">
            {users.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <li key={user.id} className={`${USER_TABLE_GRID} py-3 text-sm`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{user.email}</span>
                    <Badge variant="outline" className="shrink-0 font-normal">
                      {user.signInMethod}
                    </Badge>
                  </div>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {user.firstName || "—"}
                  </span>
                  <Badge
                    variant={user.role.name === "admin" ? "default" : "secondary"}
                    className="w-fit shrink-0"
                  >
                    {user.role.name}
                  </Badge>
                  <span />
                  <div className="flex justify-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={roleMutation.isPending}
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      {!isSelf && (
                        <DropdownMenuContent align="end">
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Change Role</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {AVAILABLE_ROLES.map((role) => (
                                <DropdownMenuCheckboxItem
                                  key={role}
                                  checked={user.role.name === role}
                                  onSelect={() => handleRoleChange(user, role)}
                                >
                                  {role}
                                </DropdownMenuCheckboxItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </DropdownMenuContent>
                      )}
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Create a local account. The user will be required to change their password on first
              login.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-first-name">First name (optional)</Label>
              <Input
                id="user-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Initial password</Label>
              <Input
                id="user-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={createRole}
                onValueChange={(value) => setCreateRole(value as "admin" | "user")}
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => !open && setPendingRoleChange(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demote to user?</DialogTitle>
            <DialogDescription>
              {pendingRoleChange
                ? `Demote ${pendingRoleChange.email} from admin to user? They will lose admin access.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRoleChange(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={roleMutation.isPending}
              onClick={() => {
                if (pendingRoleChange) {
                  roleMutation.mutate({
                    userId: pendingRoleChange.userId,
                    role: pendingRoleChange.newRole,
                  });
                }
              }}
            >
              {roleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Demote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
