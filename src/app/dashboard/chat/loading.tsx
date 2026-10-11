export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center animate-pulse">
      <div className="h-8 w-40 bg-muted rounded mb-2" />
      <div className="h-4 w-64 bg-muted rounded" />
    </div>
  );
}
