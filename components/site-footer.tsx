const socials = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/abdullahasgerali" },
  { label: "Instagram", href: "https://www.instagram.com/nvmitszipler" },
  { label: "GitHub", href: "https://github.com/uffabdullah" },
];

export function SiteFooter() {
  return (
    <footer className="colophon">
      <div className="socials">
        {socials.map((item) => (
          <a key={item.label} href={item.href} target="_blank" rel="noreferrer">
            {item.label}
          </a>
        ))}
      </div>
      <p className="made">
        Made with love <Heart /> by <strong>Abdullah Asger Ali</strong>
      </p>
      <p>First Year Computer Science and Engineering (Data Science) Student</p>
      <p>
        <a href="/extension">Browser extension</a> · <a href="/demo">Sample console</a>
      </p>
    </footer>
  );
}

function Heart() {
  return (
    <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-9.1C5 8 6.8 6.2 9 6.2c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.2 0 4 1.8 4 4.7C19 15.6 12 20 12 20z" />
    </svg>
  );
}
