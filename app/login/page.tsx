import { AuthForm } from "@/components/console/controls";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/console") ? params.next : "/console";
  return (
    <main className="auth-screen">
      <div className="auth-copy">
        <p className="eyebrow">Website change detector</p>
        <h1 className="display">Enter</h1>
        <p className="deck">Public pages only. The queue never stores a password for a site you watch.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode="in" next={next} />
        <p className="quiet">New here? <a href="/signup">Create an account</a></p>
      </div>
    </main>
  );
}
