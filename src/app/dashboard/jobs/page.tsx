import { JobTracker } from "@/components/jobs/JobTracker";

export default function JobsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Applications
      </h1>
      <JobTracker />
    </div>
  );
}
