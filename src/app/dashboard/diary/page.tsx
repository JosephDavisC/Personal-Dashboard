import { DiaryTracker } from "@/components/diary/DiaryTracker";

export default function DiaryPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          Diary
        </h1>
        <p className="mt-1 text-sm text-muted-foreground hidden sm:block">
          Your personal journal.
        </p>
      </div>
      <DiaryTracker />
    </div>
  );
}
