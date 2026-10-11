import { DatabaseBrowser } from "@/components/database/DatabaseBrowser";

export default function DatabasePage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Database
      </h1>
      <DatabaseBrowser />
    </div>
  );
}
