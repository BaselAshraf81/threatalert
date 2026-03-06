import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-background text-foreground px-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="relative mb-2">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle, rgba(229,77,66,0.15), transparent 70%)',
              boxShadow: '0 0 32px rgba(229,77,66,0.2)',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e54d42"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
        </div>
        <h1 className="text-5xl font-bold tabular-nums" style={{ color: '#e54d42' }}>404</h1>
        <p className="text-lg font-medium text-foreground mt-1">Incident not found</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          This incident has expired, been resolved, or the link is broken.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-xl border border-border/50 bg-card/75 px-5 py-2.5 text-sm font-medium text-foreground backdrop-blur-md transition-all hover:border-border hover:bg-card/90"
      >
        Back to the map
      </Link>
    </main>
  )
}
