import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function Announcements() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  useEffect(() => { api.getAnnouncements().then(setItems).catch(() => setItems([])); }, []);

  const handleCreate = async () => {
    try {
      await api.createAnnouncement({ title: 'Quick note', message: `Posted by ${user?.name}` });
      const data = await api.getAnnouncements();
      setItems(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (<div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Announcements</h1>
      <p className="text-sm text-muted-foreground">Company announcements and notices.</p>
    </div>

    <div className="flex gap-2">
      <Button onClick={handleCreate}>Post Quick Announcement</Button>
    </div>

    <div className="rounded-lg border bg-card p-4">
      {items.length === 0 && <p className="text-sm text-muted-foreground">No announcements yet.</p>}
      <ul className="space-y-3">
        {items.map(a => (<li key={a.id}><strong>{a.title}</strong> — <div className="text-sm text-muted-foreground">{a.message}</div></li>))}
      </ul>
    </div>
  </div>);
}
