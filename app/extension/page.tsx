export default function ExtensionPage() {
  return (
    <main className="shell-main">
      <p className="eyebrow">Bonus</p>
      <h1 className="display display-sm">Extension</h1>
      <p className="deck">It reads the tab you already have open and sends that public URL to the console. It does not log in to the page, and it does not store credentials.</p>
      <ol>
        <li>Download the extension folder from the repository, under <code>extension</code>.</li>
        <li>Open Chrome or Edge, then Extensions, and turn on Developer mode.</li>
        <li>Choose Load unpacked and select that folder.</li>
        <li>On a public page, open the extension and choose Watch this page.</li>
      </ol>
      <p><a className="btn btn-hot" href="/still-extension.zip">Download the extension</a></p>
      <p className="quiet">After you sign in, the new-page form is filled with the tab’s address. Private browser pages and non-http addresses are refused.</p>
    </main>
  );
}
