import { DatabaseBackup, Github } from "lucide-react";
import { BackupPage } from "@/components/backup/BackupPage";
import { Card, CardContent } from "@/components/ui/card";
import { isReadOnlyDemo, PROJECT_REPO_URL } from "@/lib/demo";

export default function BackupRoute() {
  if (!isReadOnlyDemo()) return <BackupPage />;

  // The live demo has nothing worth backing up, and exports are blocked server-side
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Backup</h1>
      <Card className="border-border bg-card">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <DatabaseBackup className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <p className="font-heading text-lg font-semibold text-foreground">Backups are off in the live demo</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              In your own copy this page exports everything to CSV, JSON snapshots and a PDF report,
              and can sync to Google Sheets and back up to Google Drive on a schedule.
            </p>
          </div>
          <a
            href={PROJECT_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Github className="h-4 w-4" />
            Run your own from GitHub
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
