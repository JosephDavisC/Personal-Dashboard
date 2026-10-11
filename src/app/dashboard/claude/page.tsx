import { ClaudeMetrics } from "@/components/claude/ClaudeMetrics";

export default function ClaudePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Claude
        </h1>
        <p className="mt-1 text-muted-foreground">
          API usage, costs, and token metrics.
        </p>
      </div>

      <ClaudeMetrics />
    </div>
  );
}
