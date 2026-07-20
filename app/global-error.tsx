"use client";

import { useEffect } from "react";

// Only rendered if the root layout itself throws -- Next.js replaces the
// entire tree with this, so it must render its own <html>/<body> and stay
// self-contained (inline styles only) rather than depending on
// globals.css or any component that could itself be what broke.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          Something went wrong
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#52525b" }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            borderRadius: "9999px",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            backgroundColor: "#18181b",
            color: "#fafafa",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
