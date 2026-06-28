import { useEffect, useState } from 'react';
import * as api from '@/services/api';

export default function Leaderboard() {
  const [list, setList] = useState([]);
  useEffect(() => { api.getLeaderboard().then(setList).catch(() => setList([])); }, []);
  return (<div className="space-y-6">
    <div>
      <h1 className="text-2xl font-semibold">Leaderboard</h1>
      <p className="text-sm text-muted-foreground">Top performers across the workspace.</p>
    </div>
    <div className="rounded-lg border bg-card p-4">
      {list.length === 0 && <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>}
      <ol className="list-decimal list-inside space-y-2">
        {list.map((row) => (<li key={row.userId}><strong>{row.name}</strong> — {row.score}</li>))}
      </ol>
    </div>
  </div>);
}
