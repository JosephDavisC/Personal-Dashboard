import { TaskBoard } from "@/components/tasks/TaskBoard";

export default function TasksPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Tasks</h1>
      <TaskBoard />
    </div>
  );
}
