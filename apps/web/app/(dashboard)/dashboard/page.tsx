import { auth } from "@/auth";
import { resolveRoleHome } from "@/lib/auth/role-home";

const moduleCards = [
  {
    title: "Finance",
    body: "Journal-entry, AP/AR, and reporting workflows arrive next on top of the protected shell.",
  },
  {
    title: "BI",
    body: "The dashboard builder and live widget preview will stay flexible in layout, but fixed in metric meaning.",
  },
  {
    title: "Projects",
    body: "The Gantt path stays bounded: dependency visibility and drag reschedule without turning into a scheduling engine.",
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const roleHome = resolveRoleHome(session?.user.roles ?? []);

  return (
    <section className="page-stack">
      <article className="surface hero-surface">
        <div>
          <div className="eyebrow">Role Home</div>
          <h2 style={{ marginBottom: "0.35rem" }}>{roleHome.title}</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {roleHome.description}
          </p>
          <p style={{ margin: "0.85rem 0 0", color: "var(--brand-strong)", fontWeight: 700 }}>
            {roleHome.emphasis}
          </p>
        </div>
      </article>

      <section className="grid-cards">
        {moduleCards.map((card) => (
          <article key={card.title} className="surface" style={{ padding: "1.25rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.4rem" }}>{card.title}</h3>
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {card.body}
            </p>
          </article>
        ))}
      </section>
    </section>
  );
}
