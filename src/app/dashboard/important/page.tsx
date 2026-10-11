import { ImportantPage } from "@/components/important/ImportantPage";

export default function Page() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Important
      </h1>
      <ImportantPage />
    </div>
  );
}
