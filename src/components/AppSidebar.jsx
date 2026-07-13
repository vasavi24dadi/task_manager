import { useAuth } from '@/contexts/AuthContext';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar, } from '@/components/ui/sidebar';
import { LayoutDashboard, FolderKanban, ListChecks, Users, Layers, LogOut, BarChart3, BriefcaseBusiness, MessagesSquare, Package, CalendarCheck, Star, Trophy, Megaphone, Clock3, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/rbac';
const coreMenuItems = [
    { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Projects', url: '/projects', icon: FolderKanban, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Tasks', url: '/tasks', icon: ListChecks, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Messages & Calls', url: '/messages', icon: MessagesSquare, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Deployments', url: '/deployments', icon: Package, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Analytics', url: '/analytics', icon: BarChart3, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Announcements', url: '/announcements', icon: Megaphone, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Attendance', url: '/attendance', icon: CalendarCheck, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
    { title: 'Performance', url: '/performance', icon: Star, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR'] },
    { title: 'Leaderboard', url: '/leaderboard', icon: Trophy, roles: ['ADMIN', 'MANAGER', 'PROJECT_MANAGER', 'TEAM_LEADER', 'TEAM_MEMBER', 'HR', 'INTERN'] },
];
const adminMenuItems = [
    { title: 'Users', url: '/users', icon: Users, roles: ['ADMIN'] },
    { title: 'Pending Requests', url: '/pending-requests', icon: Clock3, roles: ['ADMIN'] },
    { title: 'Teams', url: '/teams', icon: Users, roles: ['ADMIN'] },
    { title: 'Task Provider', url: '/admin-provider', icon: BriefcaseBusiness, roles: ['ADMIN'] },
    { title: 'Project Submissions', url: '/project-submissions', icon: Package, roles: ['ADMIN'] },
];
export function AppSidebar() {
    const { user, hasRole, logout } = useAuth();
    const { state } = useSidebar();
    const collapsed = state === 'collapsed';
    const location = useLocation();
    const coreMenu = coreMenuItems.filter(item => hasRole(item.roles));
    const adminMenu = adminMenuItems.filter(item => hasRole(item.roles));
    return (<Sidebar collapsible="icon" className="border-r border-sidebar-border/60 bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-4 border-b border-sidebar-border/70">
        <Layers className="h-6 w-6 text-sidebar-primary shrink-0"/>
        {!collapsed && (<div className="leading-tight">
            <span className="font-bold text-lg text-sidebar-foreground tracking-tight">TaskFlow</span>
            <p className="text-[11px] text-sidebar-muted">Workspace</p>
          </div>)}
      </div>

      <SidebarContent className="pt-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider mb-1">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {coreMenu.map(item => (<SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink to={item.url} end className="rounded-xl hover:bg-sidebar-accent/75 transition-colors" activeClassName="bg-sidebar-primary/95 text-sidebar-primary-foreground shadow-[0_8px_20px_-12px_rgba(79,70,229,0.9)] font-medium">
                      <item.icon className="h-4 w-4 shrink-0"/>
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminMenu.length > 0 && (<SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-wider mb-1">
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {adminMenu.map(item => (<SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                      <NavLink to={item.url} end className="rounded-xl hover:bg-sidebar-accent/75 transition-colors" activeClassName="bg-sidebar-primary/95 text-sidebar-primary-foreground shadow-[0_8px_20px_-12px_rgba(79,70,229,0.9)] font-medium">
                        <item.icon className="h-4 w-4 shrink-0"/>
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-3">
        {!collapsed && user && (<div className="mb-2 rounded-xl bg-sidebar-accent/60 px-3 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <p className="text-xs text-sidebar-muted truncate">{user.email}</p>
            <p className="text-[10px] text-sidebar-muted uppercase tracking-wide mt-1">{roleLabel(user.role)}</p>
          </div>)}
        <Button variant="ghost" size={collapsed ? 'icon' : 'default'} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground" onClick={logout}>
          <LogOut className="h-4 w-4 shrink-0"/>
          {!collapsed && <span className="ml-2">Logout</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>);
}

