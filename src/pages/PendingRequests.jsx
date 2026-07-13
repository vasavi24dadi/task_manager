import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import * as api from '@/services/api';

export default function PendingRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPendingUsers();
      setRequests(data);
    } catch (error) {
      toast({ title: error.message || 'Unable to load requests', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (id) => {
    try {
      await api.approvePendingUser(id);
      toast({ title: 'Request approved' });
      load();
    } catch (error) {
      toast({ title: error.message || 'Unable to approve request', variant: 'destructive' });
    }
  };

  const handleReject = async (id) => {
    try {
      await api.rejectPendingUser(id);
      toast({ title: 'Request rejected' });
      load();
    } catch (error) {
      toast({ title: error.message || 'Unable to reject request', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pending Requests</h1>
        <p className="text-sm text-muted-foreground">Approve or reject new signups before they can access the workspace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signup approvals</CardTitle>
          <CardDescription>{requests.length} request{requests.length === 1 ? '' : 's'} awaiting review</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Requested Role</TableHead>
                <TableHead>Signup Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">Loading requests...</TableCell>
                </TableRow>
              )}
              {!loading && requests.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No pending requests.</TableCell>
                </TableRow>
              )}
              {!loading && requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="font-medium">{request.name}</TableCell>
                  <TableCell>{request.email}</TableCell>
                  <TableCell><Badge variant="secondary">{request.role || 'INTERN'}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{request.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleApprove(request.id)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(request.id)}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
