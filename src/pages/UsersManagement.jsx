import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FloatingInput } from '@/components/ui/floating-field';
import * as api from '@/services/api';
import { Plus, Search, Pencil, Trash2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage, roleLabel } from '@/lib/rbac';
export default function UsersPage() {
    const rolePriority = {
      ADMIN: 1,
      MANAGER: 2,
      HR: 3,
      INTERN: 4,
    };
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const load = useCallback(async () => {
      setIsLoading(true);
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
      }, [toast]);
      useEffect(() => { load(); }, [load]);
    const filtered = users
      .filter(u => {
        const matchesSearch = `${u.name || ''} ${u.email || ''}`.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || String(u.role || '').toUpperCase() === roleFilter;
        const matchesStatus = statusFilter === 'all' || String(u.status || '').toLowerCase() === statusFilter;
        return matchesSearch && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const roleDiff = (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99);
        if (roleDiff !== 0)
          return roleDiff;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    const toggleStatus = async (u) => {
        const newStatus = u.status === 'active' ? 'inactive' : 'active';
        try {
            await api.updateUser(u.id, { status: newStatus });
            toast({ title: `User ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const handleDelete = async (id) => {
        try {
        const result = await api.deleteUser(id);
        if (result?.softDeleted) {
          toast({ title: 'User has linked records, so account was deactivated instead' });
        }
        else {
          toast({ title: 'User deleted' });
        }
            load();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const handleResetPassword = async (u) => {
        try {
            const result = await api.resetUserPassword(u.id);
            toast({ title: 'Password reset', description: `Temporary password: ${result.temporaryPassword}` });
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o)
        setEditing(null); }}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4"/> Add User</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle></DialogHeader>
            <UserForm user={editing} onSave={() => { setDialogOpen(false); setEditing(null); load(); }}/>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search users…" className="pl-9 max-w-sm" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="HR">HR</SelectItem>
            <SelectItem value="INTERN">Intern</SelectItem>
            <SelectItem value="EMPLOYEE">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (<TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Loading users...</TableCell>
              </TableRow>)}
            {filtered.map(u => (<TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell><Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px]">{roleLabel(u.role)}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.status === 'active'} onCheckedChange={() => toggleStatus(u)}/>
                    <span className="text-xs text-muted-foreground capitalize">{u.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleResetPassword(u)}><KeyRound className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(u); setDialogOpen(true); }}><Pencil className="h-4 w-4"/></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id)}><Trash2 className="h-4 w-4"/></Button>
                </TableCell>
              </TableRow>))}
            {!isLoading && filtered.length === 0 && (<TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">No users found.</TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>
    </div>);
}
function UserForm({ user, onSave }) {
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [role, setRole] = useState(user?.role || 'INTERN');
    const [status, setStatus] = useState(user?.status || 'active');
    const [errors, setErrors] = useState({});
    const { toast } = useToast();
    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};
        if (!name.trim())
            nextErrors.name = 'Name is required';
        if (!email.trim())
            nextErrors.email = 'Email is required';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0)
            return;
        try {
            if (user) {
                await api.updateUser(user.id, { name, email, role, status });
                toast({ title: 'User updated' });
            }
            else {
                const created = await api.createUser({ name, email, role, status });
                toast({ title: 'User created', description: created?.temporaryPassword ? `Temporary password: ${created.temporaryPassword}` : undefined });
            }
            onSave();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    return (<form onSubmit={handleSubmit} className="space-y-4">
      <FloatingInput label="Full Name" value={name} onChange={e => setName(e.target.value)} error={errors.name}/>
      <FloatingInput type="email" label="Email Address" value={email} onChange={e => setEmail(e.target.value)} error={errors.email}/>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Select value={role} onValueChange={v => setRole(v)}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Role"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERN">INTERN</SelectItem>
              <SelectItem value="EMPLOYEE">EMPLOYEE</SelectItem>
              <SelectItem value="HR">HR</SelectItem>
              <SelectItem value="MANAGER">MANAGER</SelectItem>
              <SelectItem value="ADMIN">ADMIN</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Select value={status} onValueChange={v => setStatus(v)}>
            <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Status"/></SelectTrigger>
            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full">{user ? 'Update' : 'Create'} User</Button>
    </form>);
}

