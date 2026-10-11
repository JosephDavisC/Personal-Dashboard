import { SitesMonitor } from "@/components/sites/SitesMonitor";

export default function SitesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Sites
        </h1>
        <p className="mt-1 text-muted-foreground">
          Monitor your websites and web applications.
        </p>
      </div>

      <SitesMonitor />
    </div>
  );
}
