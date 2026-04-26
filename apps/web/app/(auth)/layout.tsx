export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className="page-shell"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        paddingBlock: "2rem",
      }}
    >
      <section
        className="surface"
        style={{
          width: "min(100%, 520px)",
          padding: "2rem",
          display: "grid",
          gap: "1rem",
        }}
      >
        <div className="page-stack">
          <div>
            <div className="eyebrow">Secure Access</div>
            <h1 style={{ marginBottom: "0.5rem" }}>Amdox sign-in flow</h1>
            <p className="muted" style={{ margin: 0 }}>
              Phase 12 separates public auth routes from the protected ERP shell so
              later Keycloak and session work has a clean boundary.
            </p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
