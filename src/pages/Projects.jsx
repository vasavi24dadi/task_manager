import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FloatingInput, FloatingTextarea } from '@/components/ui/floating-field';
import { PriorityBadge } from '@/pages/Dashboard';
import * as api from '@/services/api';
import { Plus, Search, Calendar, Users, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
const isEnabledUser = (status) => ['active', 'approved'].includes(String(status || '').toLowerCase());
export default function Projects() {
    const { role, can, user } = useAuth();
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const load = useCallback(async () => {
      setIsLoading(true);
        try {
            const projectsData = role === 'TEAM_LEADER' ? await api.getProjectsForUser(user.id) : await api.getProjects();
            setProjects(projectsData);
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
        finally {
          setIsLoading(false);
        }
      }, [role, toast, user.id]);
      useEffect(() => { load(); }, [load]);
    const filtered = projects.filter(p => {
        const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
        const matchPriority = priorityFilter === 'all' || p.priority === priorityFilter;
        return matchSearch && matchPriority;
    });
    const handleDelete = async (id) => {
        try {
            await api.deleteProject(id);
            toast({ title: 'Project deleted' });
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{role === 'TEAM_LEADER' ? 'My Projects' : 'Projects'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {can('projects:create') && (<Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o)
            setEditing(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4"/> New Project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Project' : 'Create Project'}</DialogTitle>
                <DialogDescription className="sr-only">
                  {editing ? 'Update project details, manager, and team members.' : 'Create a new project and assign manager and team members.'}
                </DialogDescription>
              </DialogHeader>
              <ProjectForm users={users} project={editing} onSave={() => { setDialogOpen(false); setEditing(null); load(); }}/>
            </DialogContent>
          </Dialog>)}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search projects…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading && (<Card className="border-dashed md:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Loading projects...</CardContent>
          </Card>)}
        {filtered.map(p => (<Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50" onClick={() => navigate(`/projects/${p.id}`)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{p.title}</CardTitle>
                <PriorityBadge priority={p.priority}/>
              </div>
              <CardDescription className="mt-1 max-h-12 overflow-hidden text-sm text-muted-foreground">{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{new Date(p.deadline).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3"/>{p.assignedUsers.length} members</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {p.assignedUsers.slice(0, 3).map(uid => {
                const u = users.find(u => u.id === uid);
                return u ? <Badge key={uid} variant="secondary" className="text-[10px]">{u.name.split(' ')[0]}</Badge> : null;
            })}
                {p.assignedUsers.length > 3 && <Badge variant="secondary" className="text-[10px]">+{p.assignedUsers.length - 3}</Badge>}
              </div>
              {(can('projects:update') || can('projects:delete')) && (<div className="flex gap-2 pt-2 border-t" onClick={e => e.stopPropagation()}>
                  {can('projects:update') && (<Button variant="ghost" size="sm" className="gap-1" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="h-3 w-3"/>Edit</Button>)}
                  {can('projects:delete') && (<Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3"/>Delete</Button>)}
                </div>)}
            </CardContent>
          </Card>))}
        {!isLoading && filtered.length === 0 && (<Card className="border-dashed md:col-span-2 xl:col-span-3">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No projects match your current filters.
            </CardContent>
          </Card>)}
      </div>
    </div>);
}
function ProjectForm({ users, project, onSave }) {
    const { user, can } = useAuth();
    const [title, setTitle] = useState(project?.title || '');
    const [description, setDescription] = useState(project?.description || '');
    const [priority, setPriority] = useState(project?.priority || 'medium');
    const [deadline, setDeadline] = useState(project?.deadline?.split('T')[0] || '');
    const [manager, setManager] = useState(project?.manager || '');
    const [assigned, setAssigned] = useState(project?.assignedUsers || []);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const toggle = (id) => setAssigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};
        if (!title.trim())
            nextErrors.title = 'Project title is required';
        if (!deadline)
            nextErrors.deadline = 'Deadline is required';
        if (!manager && can('projects:create'))
            nextErrors.manager = 'Project manager is required';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;
        setIsLoading(true);
        try {
            if (project) {
                await api.updateProject(project.id, { title, description, priority, deadline: new Date(deadline).toISOString() });
                if (manager)
                    await api.assignProjectManager(project.id, manager);
                if (assigned.length > 0)
                    await api.assignProjectMembers(project.id, assigned);
                toast({ title: 'Project updated successfully' });
            }
            else {
                const newProject = await api.createProject({ title, description, priority, deadline: new Date(deadline).toISOString(), createdBy: user.id });
                if (manager)
                    await api.assignProjectManager(newProject.id, manager);
                if (assigned.length > 0)
                    await api.assignProjectMembers(newProject.id, assigned);
                toast({ title: 'Project created with members assigned' });
            }
            onSave();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        finally {
            setIsLoading(false);
        }
    };
    const activeUsers = users.filter(u => isEnabledUser(u.status));
    const managers = activeUsers.filter(u => ['PROJECT_MANAGER', 'ADMIN'].includes(u.role));
    const assignableUsers = activeUsers;
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <FloatingInput label="Project Title" value={title} onChange={e => setTitle(e.target.value)} error={errors.title}/>
      <FloatingTextarea label="Description" value={description} onChange={e => setDescription(e.target.value)}/>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Select value={priority} onValueChange={v => setPriority(v)}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Priority"/></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-11 rounded-xl"/>
          {errors.deadline ? <p className="text-xs text-destructive">{errors.deadline}</p> : null}
        </div>
      </div>
      {can('projects:create') && (<div className="space-y-2">
        <Select value={manager} onValueChange={v => setManager(v)}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Select Project Manager"/>
          </SelectTrigger>
          <SelectContent>
            {managers.map(u => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
          </SelectContent>
        </Select>
        {errors.manager ? <p className="text-xs text-destructive">{errors.manager}</p> : null}
      </div>)}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Assign Team Members</p>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
          {assignableUsers.map(u => (<Badge key={u.id} variant={assigned.includes(u.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle(u.id)}>
              {u.name}
            </Badge>))}
        </div>
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">{isLoading ? 'Processing...' : (project ? 'Update' : 'Create')} Project</Button>
    </form>);
}

