import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function CalendarLoading() {
  return (
    <div className="space-y-8">
      <div className="h-9 w-32 animate-pulse rounded bg-muted" />
      <Card className="border-border bg-card/50">
        <CardContent className="flex items-center justify-center py-24">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-5 w-5 animate-pulse" />
            <span className="text-sm">Loading calendar...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
