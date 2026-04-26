import { ArrowUpRight } from "lucide-react";

type ModuleHomeHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
};

export function ModuleHomeHero({
  eyebrow,
  title,
  description,
  badge,
}: ModuleHomeHeroProps) {
  return (
    <section className="surface hero-surface">
      <div className="page-stack">
        <div className="pill">
          <ArrowUpRight size={16} />
          {badge}
        </div>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 style={{ marginBottom: "0.45rem" }}>{title}</h1>
          <p className="muted" style={{ margin: 0, lineHeight: 1.65, maxWidth: "60rem" }}>
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
