import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as api from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

export default function Performance() {
  const { user } = useAuth();
  const [scores, setScores] = useState([]);
  useEffect(() => {
    if (!user) return;
    api.getPerformanceForUser(user.id).then(setScores).catch(() => setScores([]));
  }, [user]);

  return (<div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Performance</h1>
      <p className="text-sm text-muted-foreground">View performance scores and feedback.</p>
    </div>

    <div className="rounded-lg border bg-card p-4">
      {scores.length === 0 && <p className="text-sm text-muted-foreground">No performance records found.</p>}
      <ul className="space-y-2">
        {scores.map(s => (<li key={s.id}><strong>{s.period}</strong>: {s.score} — {s.notes}</li>))}
      </ul>
    </div>
  </div>);
}
