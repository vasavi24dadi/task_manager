import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, PriorityBadge } from '@/pages/Dashboard';
import * as api from '@/services/api';
import { CalendarDays, MessageSquare, Pencil, Plus, Search, Send, Trash2, } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
const isEnabledUser = (status) => ['active', 'approved'].includes(String(status || '').toLowerCase());
import { FloatingInput, FloatingTextarea } from '@/components/ui/floating-field';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
const columns = [
    { key: 'pending', title: 'To Do' },
    { key: 'in_progress', title: 'In Progress' },
    { key: 'completed', title: 'Done' },
];
export default function Tasks() {
    const { can, role, user } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [search, setSearch] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [commentTask, setCommentTask] = useState(null);
    const [draggingTaskId, setDraggingTaskId] = useState(null);
    const { toast } = useToast();
    const load = useCallback(async () => {
        const [tasksData, usersData, projectsData] = await Promise.all([
            api.getTasks().catch(() => []),
            api.getUsers().catch(() => []),
            api.getProjects().catch(() => []),
        ]);
        setTasks(tasksData);
        setUsers(usersData);
        setProjects(projectsData);
    }, []);
    useEffect(() => {
        load().catch((error) => {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        });
    }, [load, role, toast, user]);
    const filtered = useMemo(() => {
        return tasks.filter((task) => {
            const s = search.toLowerCase();
            const matchSearch = task.title.toLowerCase().includes(s) || task.description.toLowerCase().includes(s);
            const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;
            return matchSearch && matchPriority;
        });
    }, [tasks, search, priorityFilter]);
    const grouped = useMemo(() => {
        return columns.map((column) => ({
            ...column,
            tasks: filtered.filter((task) => task.status === column.key),
        }));
    }, [filtered]);
    const counts = {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        overdue: tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < Date.now()).length,
    };
    const getUser = (id) => users.find((u) => u.id === id);
    const getUserName = (id) => users.find((u) => u.id === id)?.name || 'Unknown';
    const getProjectTitle = (id) => projects.find((p) => p.id === id)?.title || 'Unknown';
    const getInitials = (name) => name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const handleDelete = async (id) => {
        try {
            await api.deleteTask(id);
            toast({ title: 'Task deleted' });
            await load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const moveTask = async (taskId, nextStatus) => {
        try {
            await api.updateTaskStatus(taskId, nextStatus);
            await load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const onDrop = async (status) => {
        if (!draggingTaskId)
            return;
        setDraggingTaskId(null);
        await moveTask(draggingTaskId, status);
    };
    return (<div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{role === 'TEAM_LEADER' ? 'My Kanban' : 'Task Board'}</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan, prioritize, and ship work in a clear workflow.</p>
        </div>
        <div className="flex items-center gap-2">
          {can('tasks:create') && (<Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o)
            setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4"/>
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Task' : 'Create Task'}</DialogTitle>
                  <DialogDescription>
                    {editing ? 'Update task details and save changes.' : 'Add a task with owner, priority, and timeline.'}
                  </DialogDescription>
                </DialogHeader>
                <TaskForm users={users} projects={projects} task={editing} onSave={async () => {
                setDialogOpen(false);
                setEditing(null);
                await load();
            }}/>
              </DialogContent>
            </Dialog>)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Total" value={counts.total}/>
        <MetricTile label="Completed" value={counts.completed} tone="text-[hsl(var(--success))]"/>
        <MetricTile label="Pending" value={counts.pending} tone="text-[hsl(var(--warning))]"/>
        <MetricTile label="Overdue" value={counts.overdue} tone="text-destructive"/>
      </div>

      <Card>
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <Input placeholder="Search title or description" className="pl-9 rounded-xl h-10" value={search} onChange={(e) => setSearch(e.target.value)}/>
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full md:w-[160px] rounded-xl">
                <SelectValue placeholder="Priority"/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (<Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <h3 className="font-medium">No tasks found</h3>
            <p className="text-sm text-muted-foreground mt-1">Try changing filters or create a new task.</p>
          </CardContent>
        </Card>) : (<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {grouped.map((column) => (<div key={column.key} className="rounded-2xl border border-border/70 bg-card/75 p-3 md:p-4" onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(column.key)}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <Badge variant="outline" className="rounded-full">{column.tasks.length}</Badge>
              </div>

              <div className="space-y-3 min-h-[220px]">
                {column.tasks.map((task) => (<Card key={task.id} draggable onDragStart={() => setDraggingTaskId(task.id)} className="cursor-grab border-border/70 hover:border-primary/35 hover:shadow-[0_12px_28px_-22px_hsl(var(--primary))]">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-5">{task.title}</p>
                        <PriorityBadge priority={task.priority}/>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[140px]">{getProjectTitle(task.projectId)}</span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5"/>
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="inline-flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-border/70">
                            <AvatarImage src={getUser(task.assignedTo)?.avatar} alt={getUserName(task.assignedTo)}/>
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {getInitials(getUserName(task.assignedTo))}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground truncate max-w-[120px]">{getUserName(task.assignedTo)}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCommentTask(task)}>
                            <MessageSquare className="h-4 w-4"/>
                          </Button>
                          {can('tasks:update') && (<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => {
                            setEditing(task);
                            setDialogOpen(true);
                        }}>
                              <Pencil className="h-4 w-4"/>
                            </Button>)}
                          {can('tasks:delete') && (<Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleDelete(task.id)}>
                              <Trash2 className="h-4 w-4"/>
                            </Button>)}
                        </div>
                      </div>

                      <div className="pt-1">
                        <StatusBadge status={task.status}/>
                      </div>
                    </CardContent>
                  </Card>))}
              </div>
            </div>))}
        </div>)}

      <Dialog open={!!commentTask} onOpenChange={(o) => { if (!o)
        setCommentTask(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comments - {commentTask?.title}</DialogTitle>
            <DialogDescription>Share updates with teammates.</DialogDescription>
          </DialogHeader>
          {commentTask && <CommentsSection task={commentTask} users={users} userId={user.id} onCommentAdded={load}/>}
        </DialogContent>
      </Dialog>
    </div>);
}
function MetricTile({ label, value, tone }) {
    return (<Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone || ''}`}>{value}</p>
      </CardContent>
    </Card>);
}
function TaskForm({ users, projects, task, onSave, }) {
    const { can, user } = useAuth();
    const [title, setTitle] = useState(task?.title || '');
    const [description, setDescription] = useState(task?.description || '');
    const [projectId, setProjectId] = useState(task?.projectId || '');
    const [assignedTo, setAssignedTo] = useState(task?.assignedTo || user?.id || '');
    const [priority, setPriority] = useState(task?.priority || 'medium');
    const [status, setStatus] = useState(task?.status || 'pending');
    const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] || '');
    const [errors, setErrors] = useState({});
    const { toast } = useToast();
    const validate = () => {
        const nextErrors = {};
        if (!title.trim())
            nextErrors.title = 'Title is required';
        if (!projectId)
            nextErrors.project = 'Project is required';
        if (!assignedTo)
            nextErrors.assignee = 'Assignee is required';
        if (!dueDate)
            nextErrors.dueDate = 'Due date is required';
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate())
            return;
        try {
            if (task) {
                await api.updateTask(task.id, {
                    title,
                    description,
                    projectId,
                    assignedTo,
                    priority,
                    status,
                    dueDate: new Date(dueDate).toISOString(),
                });
                toast({ title: 'Task updated' });
            }
            else {
                await api.createTask({
                    title,
                    description,
                    projectId,
                    assignedTo,
                    priority,
                    status,
                    dueDate: new Date(dueDate).toISOString(),
                    createdBy: user?.id || assignedTo,
                });
                toast({ title: 'Task created' });
            }
            await onSave();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <FloatingInput label="Task Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title}/>
      <FloatingTextarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)}/>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select Project"/></SelectTrigger>
            <SelectContent>
              {projects.map((project) => (<SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>))}
            </SelectContent>
          </Select>
          {errors.project ? <p className="text-xs text-destructive">{errors.project}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!can('tasks:assign')}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Assign To"/></SelectTrigger>
            <SelectContent>
              {users.filter((u) => isEnabledUser(u.status) && u.role === 'TEAM_LEADER').map((member) => (<SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>))}
            </SelectContent>
          </Select>
          {errors.assignee ? <p className="text-xs text-destructive">{errors.assignee}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select value={priority} onValueChange={(value) => setPriority(value)}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Priority"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(value) => setStatus(value)}>
          <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Status"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Done</SelectItem>
          </SelectContent>
        </Select>

        <div className="space-y-1.5">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 rounded-xl"/>
          {errors.dueDate ? <p className="text-xs text-destructive">{errors.dueDate}</p> : null}
        </div>
      </div>

      <Button type="submit" className="w-full">{task ? 'Save Changes' : 'Create Task'}</Button>
    </form>);
}
function CommentsSection({ task, users, userId, onCommentAdded, }) {
    const [comment, setComment] = useState('');
    const { toast } = useToast();
    const handleAdd = async () => {
        if (!comment.trim())
            return;
        try {
            await api.addComment(task.id, userId, comment.trim());
            setComment('');
            toast({ title: 'Comment added' });
            await onCommentAdded();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<div className="space-y-4">
      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
        {task.comments.length === 0 && (<p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>)}
        {task.comments.map((c) => (<div key={c.id} className="rounded-xl border border-border/70 bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{users.find((u) => u.id === c.userId)?.name || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</p>
            </div>
            <p className="text-sm mt-1">{c.content}</p>
          </div>))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Write a comment (use @username to mention)" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} className="rounded-xl"/>
        <Button size="icon" className="rounded-xl" onClick={handleAdd}>
          <Send className="h-4 w-4"/>
        </Button>
      </div>
    </div>);
}

