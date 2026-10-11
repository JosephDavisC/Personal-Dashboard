"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function JobsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Jobs Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="flex flex-col items-center gap-4 pb-6 pt-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Applications failed to load
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message || "Could not load application data."}
            </p>
          </div>
          <Button onClick={reset} variant="outline" size="sm" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
