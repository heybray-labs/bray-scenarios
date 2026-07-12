import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterMultiSelect } from "@/components/classifications/FilterMultiSelect";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSummary } from "@heybray/identity/schema";
import { Loader2, MoreVertical, Plus, Users } from "lucide-react";
import { HttpError } from "@/lib/http-error";

type TeamRow = {
  id: number;
  name: string;
  managerId: number | null;
  managerName: string | null;
  memberCount: number;
};

type TeamsListResponse = { teams: TeamRow[] };
type UsersListResponse = { users: UserSummary[] };

const TEAM_TABLE_GRID =
  "grid w-full grid-cols-[minmax(10rem,1fr)_minmax(8rem,12rem)_5rem_auto_2.5rem] items-center gap-x-4 px-4";

const NONE_MANAGER = "__none__";

export function TeamsManagementPanel() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
  const [membersTeam, setMembersTeam] = useState<TeamRow | null>(null);
  const [deleteTeam, setDeleteTeam] = useState<TeamRow | null>(null);

  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState<string>(NONE_MANAGER);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery<TeamsListResponse>({
    queryKey: ["/api/teams"],
  });

  const { data: usersData } = useQuery<UsersListResponse>({
    queryKey: ["/api/users"],
  });

  const teams = data?.teams ?? [];
  const users = usersData?.users ?? [];

  const userOptions = users.map((u) => ({
    value: String(u.id),
    label: u.firstName ? `${u.firstName} (${u.email})` : u.email,
  }));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; managerId: number | null }) =>
      apiRequest("POST", "/api/teams", payload),
    onSuccess: () => {
      invalidate();
      toast({ title: "Team created" });
      setCreateOpen(false);
      setName("");
      setManagerId(NONE_MANAGER);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to create team";
      toast({ title: "Could not create team", description: message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      teamId,
      payload,
    }: {
      teamId: number;
      payload: { name?: string; managerId?: number | null };
    }) => apiRequest("PATCH", `/api/teams/${teamId}`, payload),
    onSuccess: () => {
      invalidate();
      toast({ title: "Team updated" });
      setEditTeam(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to update team";
      toast({ title: "Could not update team", description: message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teamId: number) => apiRequest("DELETE", `/api/teams/${teamId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Team deleted" });
      setDeleteTeam(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to delete team";
      toast({ title: "Could not delete team", description: message, variant: "destructive" });
    },
  });

  const membersMutation = useMutation({
    mutationFn: ({ teamId, memberIds: ids }: { teamId: number; memberIds: number[] }) =>
      apiRequest("PUT", `/api/teams/${teamId}/members`, { memberIds: ids }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Members updated" });
      setMembersTeam(null);
    },
    onError: (err: unknown) => {
      const message = err instanceof HttpError ? err.message : "Failed to update members";
      toast({ title: "Could not update members", description: message, variant: "destructive" });
    },
  });

  const openEdit = (team: TeamRow) => {
    setEditTeam(team);
    setName(team.name);
    setManagerId(team.managerId ? String(team.managerId) : NONE_MANAGER);
  };

  const openMembers = (team: TeamRow) => {
    setMembersTeam(team);
    const current = users.filter((u) => u.teamId === team.id).map((u) => String(u.id));
    setMemberIds(current);
  };

  const parseManagerId = (value: string): number | null =>
    value === NONE_MANAGER ? null : Number(value);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, managerId: parseManagerId(managerId) });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTeam) return;
    updateMutation.mutate({
      teamId: editTeam.id,
      payload: { name, managerId: parseManagerId(managerId) },
    });
  };

  const handleMembers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersTeam) return;
    membersMutation.mutate({
      teamId: membersTeam.id,
      memberIds: memberIds.map(Number),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Create teams, assign managers, and add members. Each user belongs to at most one team.
        </p>
        <Button size="sm" className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add team
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading teams…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive py-4">Failed to load teams.</p>
      ) : teams.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No teams yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div
            className={`${TEAM_TABLE_GRID} border-b bg-muted/40 py-2 text-xs font-medium text-muted-foreground`}
          >
            <span>Name</span>
            <span>Manager</span>
            <span>Members</span>
            <span />
            <span />
          </div>
          <ul className="divide-y">
            {teams.map((team) => (
              <li key={team.id} className={`${TEAM_TABLE_GRID} py-3 text-sm`}>
                <span className="font-medium truncate">{team.name}</span>
                <span className="truncate text-muted-foreground">
                  {team.managerName ?? "—"}
                </span>
                <span className="tabular-nums">{team.memberCount}</span>
                <span />
                <div className="flex justify-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(team)}>
                        Rename / manager
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openMembers(team)}>
                        Manage members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => setDeleteTeam(team)}
                      >
                        Delete team
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team</DialogTitle>
            <DialogDescription>Create a new team and optionally assign a manager.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Name</Label>
              <Input
                id="team-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-manager">Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="team-manager">
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_MANAGER}>No manager</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName ? `${u.firstName} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editTeam !== null} onOpenChange={(open) => !open && setEditTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit team</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Name</Label>
              <Input
                id="edit-team-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-manager">Manager</Label>
              <Select value={managerId} onValueChange={setManagerId}>
                <SelectTrigger id="edit-team-manager">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_MANAGER}>No manager</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName ? `${u.firstName} (${u.email})` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTeam(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={membersTeam !== null} onOpenChange={(open) => !open && setMembersTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage members</DialogTitle>
            <DialogDescription>
              {membersTeam
                ? `Select members for ${membersTeam.name}. Users can only belong to one team.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMembers} className="space-y-4">
            <FilterMultiSelect
              placeholder="Members"
              options={userOptions}
              selected={memberIds}
              onChange={setMemberIds}
              className="w-full"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMembersTeam(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={membersMutation.isPending}>
                {membersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save members
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTeam !== null} onOpenChange={(open) => !open && setDeleteTeam(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete team?</DialogTitle>
            <DialogDescription>
              {deleteTeam
                ? `Delete "${deleteTeam.name}"? Members will be unassigned but not deleted.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTeam(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTeam && deleteMutation.mutate(deleteTeam.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
