import { Suspense } from "react";
import { TennisTracker } from "@/components/tennis/TennisTracker";

function TennisContent() {
  return <TennisTracker />;
}

export default function TennisPage() {
  return (
    <div className="min-w-0 animate-page-fade-in space-y-6 overflow-hidden">
      <Suspense>
        <TennisContent />
      </Suspense>
    </div>
  );
}
