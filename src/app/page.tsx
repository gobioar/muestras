import GoBioSampleForm from "@/components/GoBioSampleForm";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1180px] px-6 pb-16 mt-3">
        <GoBioSampleForm />
      </main>
    </div>
  );
}