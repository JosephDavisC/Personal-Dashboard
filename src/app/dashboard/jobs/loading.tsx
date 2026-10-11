import { Loader2 } from "lucide-react";

export default function JobsLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-36 animate-pulse rounded bg-muted" />
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}
