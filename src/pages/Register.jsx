import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FloatingInput } from '@/components/ui/floating-field';
import { roleLabel } from '@/lib/rbac';
export default function RegisterPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('INTERN');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const registeredUser = await register(name, email, password, role);
        setLoading(false);
        if (registeredUser) {
            const userRole = registeredUser.role ? roleLabel(registeredUser.role) : 'Team Member';
            toast({ title: 'Account created', description: `Welcome to TaskFlow! You've been assigned as ${userRole}.` });
            navigate('/dashboard');
        } else {
            toast({ title: 'Registration failed', description: 'Email may already be in use or there was a connection issue. Try again.', variant: 'destructive' });
        }
    };
    return (<div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 subtle-grid opacity-25 pointer-events-none"/>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-8 w-8"/>
            <span className="text-2xl font-bold tracking-tight">TaskFlow</span>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>Join as a Team Member and collaborate with your team</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FloatingInput id="name" label="Full Name" value={name} onChange={e => setName(e.target.value)} required/>
              <FloatingInput id="email" type="email" label="Email" value={email} onChange={e => setEmail(e.target.value)} required/>
              <FloatingInput id="password" type="password" label="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}/>
              <div className="space-y-1">
                <label htmlFor="role" className="block text-sm font-medium text-muted-foreground">Register as</label>
                <select
                  id="role"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="INTERN">Intern</option>
                  <option value="HR">HR</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating…' : 'Create account'}</Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link></p>
          </CardFooter>
        </Card>
      </div>
    </div>);
}

