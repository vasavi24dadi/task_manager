import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function Attendance() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getAttendanceForUser(user.id).catch(() => []);
        setRecords(data || []);
      } catch (err) {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) load();
  }, [user]);

  const handleCheckIn = async () => {
    try {
      await api.createAttendance({ userId: user.id, checkIn: new Date().toISOString() });
      const data = await api.getAttendanceForUser(user.id);
      setRecords(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckOut = async (recordId) => {
    try {
      await api.updateAttendance({ id: recordId, checkOut: new Date().toISOString() });
      const data = await api.getAttendanceForUser(user.id);
      setRecords(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (<div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <p className="text-sm text-muted-foreground">Check in/out and view recent time records.</p>
    </div>

    <div className="flex gap-2">
      <Button onClick={handleCheckIn}>Check In</Button>
      <Button onClick={() => records[0] && handleCheckOut(records[0].id)}>Check Out (last)</Button>
    </div>

    <div className="rounded-lg border bg-card p-4">
      {loading && <p className="text-sm text-muted-foreground">Loading records…</p>}
      {!loading && records.length === 0 && <p className="text-sm text-muted-foreground">No records yet.</p>}
      <ul className="space-y-2">
        {records.map(r => (<li key={r.id} className="text-sm">{new Date(r.checkIn).toLocaleString()} — {r.checkOut ? new Date(r.checkOut).toLocaleString() : '—'} ({r.hours ?? '-' } hrs)</li>))}
      </ul>
    </div>
  </div>);
}
