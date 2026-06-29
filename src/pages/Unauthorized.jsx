import { Link, useLocation } from 'react-router-dom';

export default function Unauthorized() {
  const location = useLocation();
  const fromPath = location.state?.from?.pathname || '/dashboard';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Access restricted</p>
        <h1 className="mt-3 text-3xl font-semibold">You do not have permission to view this page.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you tried to open requires a different role than the one currently signed in.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to={fromPath} className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Go back
          </Link>
          <Link to="/dashboard" className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-accent">
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
