import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as api from '@/services/api';
import { FolderKanban, Plus, Search, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
const isEnabledUser = (status) => ['active', 'approved'].includes(String(status || '').toLowerCase());
export default function Teams() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [teams, setTeams] = useState([]);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [search, setSearch] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const load = useCallback(async () => {
      setIsLoading(true);
        try {
            const teamsData = await api.getTeams();
            setTeams(teamsData);
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        try {
            const usersData = await api.getUsers();
            setUsers(usersData);
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        try {
            const projectsData = await api.getProjects();
            setProjects(projectsData);
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        finally {
          setIsLoading(false);
        }
      }, [toast]);
    useEffect(() => {
        load();
      }, [load]);
    const activeUsers = useMemo(() => users.filter((teamMember) => isEnabledUser(teamMember.status) && teamMember.role !== 'TEAM_MEMBER'), [users]);
    const filteredTeams = teams.filter((team) => {
        const query = search.toLowerCase();
        return team.name.toLowerCase().includes(query) || team.description.toLowerCase().includes(query);
    });
    const memberName = (id) => users.find((userItem) => userItem.id === id)?.name || 'Unknown';
    const projectTitle = (id) => projects.find((project) => project.id === id)?.title || 'Unknown';
    const handleDelete = async (id) => {
        try {
            await api.deleteTeam(id);
            toast({ title: 'Team deleted' });
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const totals = {
        teams: teams.length,
        members: new Set(teams.flatMap((team) => team.members)).size,
        projects: new Set(teams.flatMap((team) => team.projects)).size,
    };
    return (<div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create delivery groups, add members, and attach shared projects.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open)
                setEditingTeam(null);
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4"/>
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl overflow-hidden p-0">
            <DialogHeader className="sticky top-0 z-10 border-b bg-background px-6 py-4">
              <DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
              <DialogDescription>{editingTeam ? 'Update the team details and members below.' : 'Create a new team and assign members to shared projects.'}</DialogDescription>
            </DialogHeader>
            <TeamForm team={editingTeam} users={activeUsers} projects={projects} currentUserId={user.id} onSave={() => {
            setDialogOpen(false);
            setEditingTeam(null);
            load();
        }}/>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Teams</p>
            <p className="mt-2 text-2xl font-bold">{totals.teams}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Members Covered</p>
            <p className="mt-2 text-2xl font-bold">{totals.members}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Shared Projects</p>
            <p className="mt-2 text-2xl font-bold">{totals.projects}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
        <Input placeholder="Search teams…" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)}/>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {isLoading && (<Card className="border-dashed xl:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading teams...</CardContent>
          </Card>)}
        {filteredTeams.map((team) => (<Card key={team.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4"/>
                    {team.name}
                  </CardTitle>
                  <CardDescription className="mt-1 max-h-12 overflow-hidden text-sm text-muted-foreground">{team.description}</CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {team.members.length} members
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Members</Label>
                <div className="flex flex-wrap gap-2">
                  {team.members.length > 0 ? team.members.map((memberId) => (<Badge key={memberId} variant="outline" className="text-[10px]">
                      {memberName(memberId)}
                    </Badge>)) : (<span className="text-sm text-muted-foreground">No members added.</span>)}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Projects</Label>
                <div className="flex flex-wrap gap-2">
                  {team.projects.length > 0 ? team.projects.map((projectId) => (<Badge key={projectId} variant="secondary" className="text-[10px] gap-1">
                      <FolderKanban className="h-3 w-3"/>
                      {projectTitle(projectId)}
                    </Badge>)) : (<span className="text-sm text-muted-foreground">No projects linked yet.</span>)}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                <span>Created {new Date(team.createdAt).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                setEditingTeam(team);
                setDialogOpen(true);
            }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(team.id)}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>))}
        {!isLoading && filteredTeams.length === 0 && (<Card className="border-dashed xl:col-span-2">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No teams found for your search.
            </CardContent>
          </Card>)}
      </div>
    </div>);
}
function TeamForm({ team, users, projects, currentUserId, onSave, }) {
    const { toast } = useToast();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [members, setMembers] = useState([]);
    const [linkedProjects, setLinkedProjects] = useState([]);
    useEffect(() => {
        setName(team?.name || '');
        setDescription(team?.description || '');
        setMembers(team?.members || []);
        setLinkedProjects(team?.projects || []);
    }, [team]);
    const toggleItem = (value, selected, setSelected) => {
        setSelected((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            if (team) {
                await api.updateTeam(team.id, { name, description, members, projects: linkedProjects });
                toast({ title: 'Team updated' });
            }
            else {
                await api.createTeam({
                    name,
                    description,
                    createdBy: currentUserId,
                    members,
                    projects: linkedProjects,
                });
                toast({ title: 'Team created' });
            }
            onSave();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<form onSubmit={handleSubmit} className="flex max-h-[80vh] min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <Label>Team name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required/>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} required/>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label>Assign users</Label>
            <span className="text-xs text-muted-foreground">{members.length} selected</span>
          </div>
          <ScrollArea className="h-48 rounded-md border bg-background p-3">
            <div className="flex flex-wrap gap-2">
              {users.map((teamUser) => (<Button key={teamUser.id} type="button" variant={members.includes(teamUser.id) ? 'default' : 'outline'} size="sm" onClick={() => toggleItem(teamUser.id, members, setMembers)}>
                  {teamUser.name}
                </Button>))}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <Label>Assign projects</Label>
            <span className="text-xs text-muted-foreground">{linkedProjects.length} selected</span>
          </div>
          <ScrollArea className="h-48 rounded-md border bg-background p-3">
            <div className="flex flex-wrap gap-2">
              {projects.map((project) => (<Button key={project.id} type="button" variant={linkedProjects.includes(project.id) ? 'default' : 'outline'} size="sm" onClick={() => toggleItem(project.id, linkedProjects, setLinkedProjects)}>
                  {project.title}
                </Button>))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t bg-background/95 px-6 py-4 backdrop-blur">
        <Button type="submit" className="w-full">
          {team ? 'Update' : 'Create'} Team
        </Button>
      </div>
    </form>);
}

