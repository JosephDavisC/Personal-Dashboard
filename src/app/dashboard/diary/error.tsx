"use client";

import { Button } from "@/components/ui/button";

export default function DiaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {error.message || "Failed to load diary."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
