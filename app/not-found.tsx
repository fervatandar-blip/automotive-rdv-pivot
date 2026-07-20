import Link from "next/link";

// The true App Router root -- there is no app/layout.tsx in this project
// (app/[lang]/layout.tsx serves that role for every localized route), so a
// path that fails to match anything, even a valid /fr or /en prefix plus an
// unknown segment, falls back to this file rather than the nested
// app/[lang]/not-found.tsx, which only reliably catches an explicit
// notFound() call from within an already-matched page. Self-contained (own
// <html>/<body>, no Tailwind class names) for the same reason as
// global-error.tsx: this is the outermost fallback, so it can't lean on
// anything that might not be available.
export default function RootNotFound() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#fafafa",
          color: "#18181b",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          Page not found
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#52525b" }}>
          The page you&apos;re looking for doesn&apos;t exist or may have
          been moved.
        </p>
        <Link
          href="/"
          style={{
            borderRadius: "9999px",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            backgroundColor: "#18181b",
            color: "#fafafa",
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </body>
    </html>
  );
}
