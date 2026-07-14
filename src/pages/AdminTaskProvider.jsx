import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import * as api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { Calendar, FolderKanban, UserPlus } from 'lucide-react';
import { extractErrorMessage } from '@/lib/rbac';
const isEnabledUser = (status) => ['active', 'approved'].includes(String(status || '').toLowerCase());
const NEW_USER_WINDOW_DAYS = 45;
export default function AdminTaskProvider() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedProjectByUser, setSelectedProjectByUser] = useState({});
    const [dialogOpen, setDialogOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [deadline, setDeadline] = useState('');
    const [assignee, setAssignee] = useState('');
    const load = useCallback(async () => {
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
      }, [toast]);
    useEffect(() => {
        load();
      }, [load]);
   const projectIdsByUser = useMemo(() => {
    const map = {};

    for (const p of projects) {
        const assignedUsers = Array.isArray(p.assignedUsers)
            ? p.assignedUsers
            : [];

        for (const uid of assignedUsers) {
            if (!map[uid]) {
                map[uid] = [];
            }

            map[uid].push(p.id);
        }
    }

    return map;
}, [projects]);
    const activeUsers = useMemo(() => users.filter((u) => isEnabledUser(u.status) && u.role !== 'ADMIN'), [users]);
    const newUsers = useMemo(() => {
        const now = Date.now();
        const recentMs = NEW_USER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
        return activeUsers.filter((u) => {
            const createdAtMs = new Date(u.createdAt).getTime();
            const isRecent = now - createdAtMs <= recentMs;
            const hasNoProject = !projectIdsByUser[u.id] || projectIdsByUser[u.id].length === 0;
            return isRecent || hasNoProject;
        });
    }, [activeUsers, projectIdsByUser]);
    const usersToDisplay = newUsers.length > 0 ? newUsers : activeUsers;
    const assignExistingProject = async (userId) => {
        const projectId = selectedProjectByUser[userId];
        if (!projectId) {
            toast({ title: 'Select a project first', variant: 'destructive' });
            return;
        }
        const project = projects.find((p) => p.id === projectId);
        if (!project) {
            toast({ title: 'Project not found', variant: 'destructive' });
            return;
        }
        const assignedUsers = Array.isArray(project.assignedUsers)
    ? project.assignedUsers
    : [];

if (assignedUsers.includes(userId)) {
            toast({ title: 'User already assigned to this project' });
            return;
        }
        try {
          const members = await api.getProjectMembers(project.id);
          const currentIds = (members || []).map((member) => member.user_id);
          const nextIds = Array.from(new Set([...currentIds, userId]));
          await api.assignProjectMembers(project.id, nextIds);
            toast({ title: 'User assigned to project' });
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const handleCreateAndAssign = async (e) => {
        e.preventDefault();
        if (!assignee) {
            toast({ title: 'Select a user', variant: 'destructive' });
            return;
        }
        try {
            await api.createProject({
                title,
                description,
                priority,
                deadline: new Date(deadline).toISOString(),
                assignedUsers: assignee ? [assignee] : [],
                createdBy: user.id,
            });
            toast({ title: 'New project created and assigned' });
            setDialogOpen(false);
            setTitle('');
            setDescription('');
            setPriority('medium');
            setDeadline('');
            setAssignee('');
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Task Provider</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign users to projects or create a fresh project for them.
          </p>
          {newUsers.length === 0 && activeUsers.length > 0 && (<p className="text-xs text-muted-foreground mt-1">
              No recent or unassigned users found. Showing all active users instead.
            </p>)}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <FolderKanban className="h-4 w-4"/>
              Create + Assign Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create project for a new user</DialogTitle>
              <DialogDescription className="sr-only">
                Create a new project and assign it to a selected team member.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAndAssign} className="space-y-4">
              <div className="space-y-2">
                <Label>Project title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required/>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={(value) => setPriority(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required/>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign to user</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select user"/>
                  </SelectTrigger>
                  <SelectContent>
                      {usersToDisplay.map((u) => (<SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full">Create and assign</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {usersToDisplay.map((u) => {
            const assignedProjectIds = projectIdsByUser[u.id] || [];
            const assignedProjects = projects.filter((p) => assignedProjectIds.includes(p.id));
            return (<Card key={u.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserPlus className="h-4 w-4"/>
                  {u.name}
                </CardTitle>
                <CardDescription>{u.email}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3"/>
                  Joined {new Date(u.createdAt).toLocaleDateString()}
                </div>

                <div className="space-y-2">
                  <Label>Current projects</Label>
                  <div className="flex flex-wrap gap-2 min-h-8">
                    {assignedProjects.length > 0 ? (assignedProjects.map((p) => (<Badge key={p.id} variant="secondary" className="text-[10px]">
                          {p.title}
                        </Badge>))) : (<span className="text-xs text-muted-foreground">No projects assigned yet.</span>)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Assign existing project</Label>
                  <div className="flex gap-2">
                    <Select value={selectedProjectByUser[u.id] || ''} onValueChange={(value) => setSelectedProjectByUser((prev) => ({ ...prev, [u.id]: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose project"/>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (<SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => assignExistingProject(u.id)}>Assign</Button>
                  </div>
                </div>
              </CardContent>
            </Card>);
        })}
      </div>

      {usersToDisplay.length === 0 && (<Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No active users found for assignment right now.
          </CardContent>
        </Card>)}
    </div>);
}

