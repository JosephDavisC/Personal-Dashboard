import { SHIFT_LOCATIONS } from "@/config/shifts";

export const priorityColors: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  MEDIUM:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  URGENT:
    "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

export const taskCategoryColors: Record<string, string> = {
  school:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  work: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  personal:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
};

export const expenseCategoryColors: Record<string, string> = {
  food: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
  coffee:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  groceries:
    "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  transport:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  subscriptions:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
  entertainment:
    "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  school:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  other: "bg-muted text-muted-foreground",
};

export const shiftLocationColors: Record<string, string> = Object.fromEntries(
  SHIFT_LOCATIONS.map((l) => [l.key, l.badgeClass])
);
