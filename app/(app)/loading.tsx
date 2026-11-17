export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-56 rounded-md bg-panel2" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="card h-24 p-4">
            <div className="h-2.5 w-24 rounded bg-panel2" />
            <div className="mt-4 h-6 w-20 rounded bg-panel2" />
          </div>
        ))}
      </div>
      <div className="card h-64 p-4">
        <div className="h-3 w-40 rounded bg-panel2" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-8 rounded bg-panel2/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
