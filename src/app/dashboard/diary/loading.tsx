export default function DiaryLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <div className="h-8 w-24 bg-muted rounded" />
        <div className="mt-2 h-4 w-40 bg-muted rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 w-28 bg-muted rounded" />
        <div className="h-9 w-64 bg-muted rounded" />
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-lg bg-muted/50" />
        ))}
      </div>
    </div>
  );
}
