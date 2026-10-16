import { AuthForm } from "@/components/console/controls";

export default function SignupPage() {
  return (
    <main className="auth-screen">
      <div className="auth-copy">
        <p className="eyebrow">Website change detector</p>
        <h1 className="display">Begin</h1>
        <p className="deck">An account keeps your pages, regions, and alerts separate from everyone else.</p>
      </div>
      <div className="auth-panel">
        <AuthForm mode="up" />
        <p className="quiet">Already have one? <a href="/login">Sign in</a></p>
      </div>
    </main>
  );
}
