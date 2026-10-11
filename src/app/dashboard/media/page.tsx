import { MediaTracker } from "@/components/media/MediaTracker";

export default function MediaPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Media Storage
      </h1>
      <MediaTracker />
    </div>
  );
}
