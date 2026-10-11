"use client";

export default function Error() {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-lg font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground">Failed to load email history</p>
    </div>
  );
}
