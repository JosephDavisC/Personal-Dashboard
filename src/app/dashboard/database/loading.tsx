export default function Loading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-4">
        <div className="hidden w-56 lg:block">
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="flex-1">
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
