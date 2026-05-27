export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-3">
      <p className="text-2xl font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">Coming soon...</p>
    </div>
  );
}
