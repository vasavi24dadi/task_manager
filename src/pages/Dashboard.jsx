import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import * as api from '@/services/api';
import { AlertTriangle, BriefcaseBusiness, CalendarClock, CheckCircle2, CircleDot, Clock3, ClipboardList, FolderKanban, ListChecks, Megaphone, ShieldCheck, Sparkles, TrendingUp, ArrowRight, Users } from 'lucide-react';
import { roleLabel } from '@/lib/rbac';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
export default function Dashboard() {
    const { role, user } = useAuth();
    const normalizedRole = (role || '').toUpperCase();

    if (normalizedRole === 'MANAGER') {
        return <ManagerDashboard user={user} />;
    }

    if (normalizedRole === 'HR') {
        return <HRDashboard user={user} />;
    }

    if (normalizedRole === 'INTERN') {
        return <InternDashboard user={user} />;
    }

    if (normalizedRole === 'TEAM_LEADER' && user) {
        return <MemberDashboard userId={user.id}/>;
    }

    return <WorkspaceDashboard role={role}/>;
}
function ManagerDashboard({ user }) {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [teamMembers, setTeamMembers] = useState([]);

    useEffect(() => {
        const load = async () => {
            const [taskData, projectData, announcementData, memberData] = await Promise.all([
                api.getTasks().catch(() => []),
                api.getProjects().catch(() => []),
                api.getAnnouncements().catch(() => []),
                api.getUsers().catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
            setAnnouncements(announcementData);
            setTeamMembers(memberData.filter((member) => member.id !== user?.id));
        };
        load();
    }, [user?.id]);

    const activeTasks = tasks.filter((task) => task.status !== 'completed').length;
    const atRiskTasks = tasks.filter((task) => task.status !== 'completed' && new Date(task.dueDate).getTime() < Date.now()).length;
    const activeProjects = projects.length;
    const peopleInView = teamMembers.filter((member) => member.status === 'active').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">Manager Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Monitor delivery, keep priorities moving, and support your team closely.</p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/5 text-primary px-3 py-1">
                    <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
                    Team oversight
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Active Tasks" value={activeTasks} icon={ListChecks} color="text-primary" tone="bg-primary/10" />
                <SummaryCard title="At Risk" value={atRiskTasks} icon={AlertTriangle} color="text-destructive" tone="bg-destructive/10" />
                <SummaryCard title="Projects" value={activeProjects} icon={FolderKanban} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10" />
                <SummaryCard title="Team Members" value={peopleInView} icon={Users} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <DashboardSectionCard
                    title="Priority queue"
                    description="Tasks that need your attention today"
                    actionLabel="Open tasks"
                    onAction={() => navigate('/tasks')}
                >
                    {tasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                            </div>
                            <StatusBadge status={task.status} />
                        </div>
                    ))}
                    {tasks.length === 0 && <EmptyState message="No work items have been surfaced yet." />}
                </DashboardSectionCard>

                <DashboardSectionCard
                    title="Project focus"
                    description="The workstreams currently under review"
                    actionLabel="Open projects"
                    onAction={() => navigate('/projects')}
                >
                    {projects.slice(0, 5).map((project) => (
                        <div key={project.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{project.title}</p>
                                <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                            </div>
                            <PriorityBadge priority={project.priority} />
                        </div>
                    ))}
                    {projects.length === 0 && <EmptyState message="No projects are available right now." />}
                </DashboardSectionCard>

                <DashboardSectionCard
                    title="Announcements"
                    description="Updates your team should see"
                    actionLabel="View all"
                    onAction={() => navigate('/announcements')}
                >
                    {announcements.slice(0, 5).map((announcement) => (
                        <div key={announcement.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{announcement.title}</p>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{announcement.message}</p>
                        </div>
                    ))}
                    {announcements.length === 0 && <EmptyState message="No announcements published yet." />}
                </DashboardSectionCard>
            </div>
        </div>
    );
}

function HRDashboard({ user }) {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        const load = async () => {
            const [userData, taskData, announcementData] = await Promise.all([
                api.getUsers().catch(() => []),
                api.getTasks().catch(() => []),
                api.getAnnouncements().catch(() => []),
            ]);
            setUsers(userData);
            setTasks(taskData);
            setAnnouncements(announcementData);
        };
        load();
    }, [user?.id]);

    const activePeople = users.filter((person) => person.status === 'active').length;
    const pendingWork = tasks.filter((task) => task.status !== 'completed').length;
    const publishedUpdates = announcements.length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">HR Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Keep people, priorities, and company updates aligned in one place.</p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/5 text-primary px-3 py-1">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                    People operations
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Active People" value={activePeople} icon={Users} color="text-primary" tone="bg-primary/10" />
                <SummaryCard title="Open Work" value={pendingWork} icon={ClipboardList} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10" />
                <SummaryCard title="Announcements" value={publishedUpdates} icon={Megaphone} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10" />
                <SummaryCard title="Support Needed" value={Math.max(0, pendingWork - 1)} icon={CalendarClock} color="text-destructive" tone="bg-destructive/10" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <DashboardSectionCard title="People snapshot" description="Current active users visible in the workspace" actionLabel="Manage users" onAction={() => navigate('/users')}>
                    {users.slice(0, 6).map((person) => (
                        <div key={person.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{person.name}</p>
                                <p className="text-xs text-muted-foreground">{person.role || 'Member'}</p>
                            </div>
                            <Badge variant="outline" className="text-[11px] rounded-full">{person.status || 'active'}</Badge>
                        </div>
                    ))}
                    {users.length === 0 && <EmptyState message="No user records are available yet." />}
                </DashboardSectionCard>

                <DashboardSectionCard title="Work in progress" description="Tasks that still need follow-up" actionLabel="Open tasks" onAction={() => navigate('/tasks')}>
                    {tasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">{task.status}</p>
                            </div>
                            <StatusBadge status={task.status} />
                        </div>
                    ))}
                    {tasks.length === 0 && <EmptyState message="No work items have been created yet." />}
                </DashboardSectionCard>

                <DashboardSectionCard title="Team updates" description="Latest announcements for everyone" actionLabel="View updates" onAction={() => navigate('/announcements')}>
                    {announcements.slice(0, 5).map((announcement) => (
                        <div key={announcement.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{announcement.title}</p>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{announcement.message}</p>
                        </div>
                    ))}
                    {announcements.length === 0 && <EmptyState message="No updates posted yet." />}
                </DashboardSectionCard>
            </div>
        </div>
    );
}

function InternDashboard({ user }) {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        const load = async () => {
            const [taskData, projectData, announcementData] = await Promise.all([
                api.getTasksForUser(user?.id).catch(() => []),
                api.getProjectsForUser(user?.id).catch(() => []),
                api.getAnnouncements().catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
            setAnnouncements(announcementData);
        };
        load();
    }, [user?.id]);

    const assignedTasks = tasks.filter((task) => task.assignedTo === user?.id).length;
    const pendingTasks = tasks.filter((task) => task.status !== 'completed').length;
    const upcomingDue = tasks.filter((task) => task.status !== 'completed' && new Date(task.dueDate).getTime() > Date.now()).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">My Work</h1>
                    <p className="text-sm text-muted-foreground mt-1">See your assignments, project contributions, and current team updates.</p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/5 text-primary px-3 py-1">
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Personal focus
                </Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard title="Assigned Tasks" value={assignedTasks} icon={ListChecks} color="text-primary" tone="bg-primary/10" />
                <SummaryCard title="Pending" value={pendingTasks} icon={Clock3} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10" />
                <SummaryCard title="Projects" value={projects.length} icon={FolderKanban} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10" />
                <SummaryCard title="Upcoming" value={upcomingDue} icon={CalendarClock} color="text-destructive" tone="bg-destructive/10" />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <DashboardSectionCard title="Your tasks" description="Priority work assigned to you" actionLabel="Open tasks" onAction={() => navigate('/tasks')}>
                    {tasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                            </div>
                            <StatusBadge status={task.status} />
                        </div>
                    ))}
                    {tasks.length === 0 && <EmptyState message="No tasks are assigned to you yet." />}
                </DashboardSectionCard>

                <DashboardSectionCard title="Your projects" description="Project areas where you are contributing" actionLabel="View projects" onAction={() => navigate('/projects')}>
                    {projects.slice(0, 5).map((project) => (
                        <div key={project.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                            <div>
                                <p className="text-sm font-medium">{project.title}</p>
                                <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                            </div>
                            <PriorityBadge priority={project.priority} />
                        </div>
                    ))}
                    {projects.length === 0 && <EmptyState message="You are not part of any projects yet." />}
                </DashboardSectionCard>

                <DashboardSectionCard title="Team notices" description="Announcements and reminders that matter" actionLabel="View all" onAction={() => navigate('/announcements')}>
                    {announcements.slice(0, 5).map((announcement) => (
                        <div key={announcement.id} className="rounded-xl border border-border/70 bg-background/60 p-3">
                            <div className="flex items-center gap-2">
                                <Megaphone className="h-4 w-4 text-primary" />
                                <p className="text-sm font-medium">{announcement.title}</p>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">{announcement.message}</p>
                        </div>
                    ))}
                    {announcements.length === 0 && <EmptyState message="No notices have been shared yet." />}
                </DashboardSectionCard>
            </div>
        </div>
    );
}

function WorkspaceDashboard({ role }) {
    useEffect(() => {
        const load = async () => {
            const [taskData, projectData, teamsData] = await Promise.all([
                api.getTasks().catch(() => []),
                api.getProjects().catch(() => []),
                api.getTeams().catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
            setTeams(teamsData);
        };
        load();
    }, []);
    const now = Date.now();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
    const overdueTasks = tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < now).length;
    const filteredTasks = useMemo(() => {
      if (taskFilter === 'completed')
        return tasks.filter((task) => task.status === 'completed');
      if (taskFilter === 'pending')
        return tasks.filter((task) => task.status !== 'completed');
      return tasks;
    }, [taskFilter, tasks]);
    const statusData = [
        { name: 'To Do', value: tasks.filter((t) => t.status === 'pending').length, color: '#f59e0b' },
        { name: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress').length, color: '#4f46e5' },
        { name: 'Done', value: tasks.filter((t) => t.status === 'completed').length, color: '#16a34a' },
    ];
    const productivityData = useMemo(() => {
        const base = [
            { label: 'Mon', completed: 0, created: 0 },
            { label: 'Tue', completed: 0, created: 0 },
            { label: 'Wed', completed: 0, created: 0 },
            { label: 'Thu', completed: 0, created: 0 },
            { label: 'Fri', completed: 0, created: 0 },
            { label: 'Sat', completed: 0, created: 0 },
            { label: 'Sun', completed: 0, created: 0 },
        ];
        tasks.forEach((task) => {
            const createdDate = new Date(task.createdAt);
            const completedDate = new Date(task.dueDate);
            const createdDay = createdDate.getDay();
            base[createdDay === 0 ? 6 : createdDay - 1].created += 1;
            if (task.status === 'completed') {
                const doneDay = completedDate.getDay();
                base[doneDay === 0 ? 6 : doneDay - 1].completed += 1;
            }
        });
        return base;
    }, [tasks]);
    return (<div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{roleLabel(role)} Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live insights on project performance and delivery health.</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/5 text-primary px-3 py-1">
          <TrendingUp className="mr-1 h-3.5 w-3.5"/>
          {teams.length} teams • {projects.length} projects
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Tasks" value={totalTasks} icon={ListChecks} color="text-primary" tone="bg-primary/10" onClick={() => setTaskFilter('all')} active={taskFilter === 'all'}/>
        <SummaryCard title="Completed Tasks" value={completedTasks} icon={CheckCircle2} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10" onClick={() => setTaskFilter('completed')} active={taskFilter === 'completed'}/>
        <SummaryCard title="Pending Tasks" value={pendingTasks} icon={Clock3} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10" onClick={() => setTaskFilter('pending')} active={taskFilter === 'pending'}/>
        <SummaryCard title="Overdue Tasks" value={overdueTasks} icon={AlertTriangle} color="text-destructive" tone="bg-destructive/10"/>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Team Productivity</CardTitle>
            <CardDescription>Created vs completed tasks this week</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }}/>
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }}/>
                <Tooltip contentStyle={{
            borderRadius: 12,
            borderColor: 'hsl(var(--border))',
            fontSize: 12,
        }}/>
                <Bar dataKey="created" radius={[8, 8, 0, 0]} fill="#818cf8"/>
                <Bar dataKey="completed" radius={[8, 8, 0, 0]} fill="#22c55e"/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Progress</CardTitle>
            <CardDescription>Distribution across workflow stages</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {statusData.map((entry) => (<Cell key={entry.name} fill={entry.color}/>))}
                </Pie>
                <Tooltip contentStyle={{
            borderRadius: 12,
            borderColor: 'hsl(var(--border))',
            fontSize: 12,
        }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
              {statusData.map((item) => (<div key={item.name} className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleDot className="h-3.5 w-3.5" style={{ color: item.color }}/>
                  <span>{item.name}</span>
                </div>))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
              <CardDescription>Latest updates from your workspace ({taskFilter})</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <Button variant={taskFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('all')}>
                All
              </Button>
              <Button variant={taskFilter === 'completed' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('completed')}>
                Completed
              </Button>
              <Button variant={taskFilter === 'pending' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('pending')}>
                Pending
              </Button>
            </div>
            {filteredTasks.slice(0, 5).map((task) => (<div 
              key={task.id} 
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/tasks')}
            >
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={task.status}/>
              </div>))}
            {filteredTasks.length === 0 && <EmptyState message={`No ${taskFilter === 'all' ? '' : `${taskFilter} `}tasks found yet.`}/>} 
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Projects</CardTitle>
              <CardDescription>Project priority and delivery timeline</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.slice(0, 5).map((project) => (<div 
              key={project.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/projects')}
            >
                <div>
                  <p className="text-sm font-medium">{project.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                </div>
                <PriorityBadge priority={project.priority}/>
              </div>))}
            {projects.length === 0 && <EmptyState message="No projects available for this workspace."/>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Teams</CardTitle>
              <CardDescription>Delivery groups and members</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/teams')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.slice(0, 5).map((team) => (<div 
              key={team.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/teams')}
            >
                <div>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>{team.members?.length || 0} members</p>
                </div>
                <Badge variant="outline" className="text-xs">{team.projects?.length || 0} projects</Badge>
              </div>))}
            {teams.length === 0 && <EmptyState message="No teams created yet. Create a team to organize your work."/>}
          </CardContent>
        </Card>
      </div>
    </div>);
}
function MemberDashboard({ userId }) {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [teams, setTeams] = useState([]);
  const [taskFilter, setTaskFilter] = useState('all');
    useEffect(() => {
        const load = async () => {
            const [taskData, projectData, teamsData] = await Promise.all([
                api.getTasksForUser(userId).catch(() => []),
                api.getProjectsForUser(userId).catch(() => []),
                api.getTeams().catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
            // Filter teams that the user is a member of
            const userTeams = teamsData.filter((team) => team.members?.includes(userId)) || [];
            setTeams(userTeams);
        };
        load();
    }, [userId]);
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const overdue = tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < Date.now()).length;
    const pending = tasks.filter((t) => t.status !== 'completed').length;
    const filteredTasks = useMemo(() => {
      if (taskFilter === 'completed')
        return tasks.filter((task) => task.status === 'completed');
      if (taskFilter === 'pending')
        return tasks.filter((task) => task.status !== 'completed');
      return tasks;
    }, [taskFilter, tasks]);
    return (<div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Work</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your assignments and keep delivery on schedule.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard title="Completed" value={completed} icon={CheckCircle2} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10" onClick={() => setTaskFilter('completed')} active={taskFilter === 'completed'}/>
        <SummaryCard title="In Progress" value={inProgress} icon={Clock3} color="text-primary" tone="bg-primary/10"/>
        <SummaryCard title="Pending" value={pending} icon={ListChecks} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10" onClick={() => setTaskFilter('pending')} active={taskFilter === 'pending'}/>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">My Tasks</CardTitle>
              <CardDescription>Tasks assigned to you ({taskFilter})</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <Button variant={taskFilter === 'all' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('all')}>
                All
              </Button>
              <Button variant={taskFilter === 'completed' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('completed')}>
                Completed
              </Button>
              <Button variant={taskFilter === 'pending' ? 'default' : 'outline'} size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setTaskFilter('pending')}>
                Pending
              </Button>
            </div>
            {filteredTasks.slice(0, 5).map((task) => (<div 
              key={task.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/tasks')}
            >
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={task.status}/>
              </div>))}
            {filteredTasks.length === 0 && <EmptyState message={`No ${taskFilter === 'all' ? '' : `${taskFilter} `}tasks assigned yet.`}/>} 
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">My Projects</CardTitle>
              <CardDescription>Projects where you contribute</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.slice(0, 5).map((project) => (<div 
              key={project.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/projects')}
            >
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FolderKanban className="h-4 w-4"/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                  </div>
                </div>
                <PriorityBadge priority={project.priority}/>
              </div>))}
            {projects.length === 0 && <EmptyState message="No projects assigned to your account."/>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">My Teams</CardTitle>
              <CardDescription>Teams you're part of</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/teams')} className="gap-1">
              View All
              <ArrowRight className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {teams.slice(0, 5).map((team) => (<div 
              key={team.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3 hover:bg-background/80 cursor-pointer transition-colors"
              onClick={() => navigate('/teams')}
            >
                <div>
                  <p className="text-sm font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>{team.members?.length || 0} members</p>
                </div>
              </div>))}
            {teams.length === 0 && <EmptyState message="No teams yet. Ask admin to add you to a team."/>}
          </CardContent>
        </Card>
      </div>
    </div>);
}
function DashboardSectionCard({ title, description, actionLabel, onAction, children }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                {actionLabel && (
                    <Button variant="ghost" size="sm" onClick={onAction} className="gap-1">
                        {actionLabel}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-3">{children}</CardContent>
        </Card>
    );
}

function SummaryCard({ title, value, icon: Icon, tone, color, onClick, active = false, }) {
    return (<Card className={onClick ? `transition-colors ${active ? 'ring-1 ring-primary/40 border-primary/40' : 'hover:border-primary/30'}` : ''}>
      <CardContent className="p-5">
        <button type="button" onClick={onClick} className="flex w-full items-start justify-between text-left" disabled={!onClick}>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-2">{value}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${tone}`}>
            <Icon className={`h-5 w-5 ${color}`}/>
          </div>
        </button>
      </CardContent>
    </Card>);
}
function EmptyState({ message }) {
    return (<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>);
}
export function StatusBadge({ status }) {
    const map = {
        pending: 'bg-[hsl(var(--warning))]/12 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25',
        in_progress: 'bg-primary/10 text-primary border-primary/20',
        completed: 'bg-[hsl(var(--success))]/12 text-[hsl(var(--success))] border-[hsl(var(--success))]/25',
    };
    const labels = { pending: 'To Do', in_progress: 'In Progress', completed: 'Done' };
    return <Badge variant="outline" className={`text-[11px] rounded-full px-2.5 ${map[status] || ''}`}>{labels[status] || status}</Badge>;
}
export function PriorityBadge({ priority }) {
    const map = {
        high: 'bg-destructive/10 text-destructive border-destructive/25',
        medium: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25',
        low: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={`text-[11px] rounded-full capitalize px-2.5 ${map[priority] || ''}`}>{priority}</Badge>;
}

