import { signOut } from "./actions";

export const maxDuration = 60;

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="/">Still</a>
        <p className="eyebrow">Website change detector</p>
        <nav className="side-nav">
          <a href="/console">Monitors</a>
          <a href="/console/new">Add a page</a>
          <a href="/demo">Sample</a>
          <a href="/extension">Extension</a>
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        </nav>
      </aside>
      <div className="shell-main">{children}</div>
    </div>
  );
}
