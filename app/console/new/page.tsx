import { MonitorForm } from "@/components/console/controls";

export default async function NewMonitorPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const params = await searchParams;
  const initialUrl = params.url && /^https?:\/\//i.test(params.url) ? params.url : "";
  return (
    <main>
      <p className="eyebrow">New page</p>
      <h1 className="display display-sm">Add a URL</h1>
      <p className="deck">Public http and https only. A password in the address is refused, and so is anything that is not on the public internet.</p>
      <MonitorForm initialUrl={initialUrl} />
    </main>
  );
}
