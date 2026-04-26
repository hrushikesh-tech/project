import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonIntent = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  intent?: ButtonIntent;
  size?: ButtonSize;
};

const intentStyles = {
  primary: {
    background: "linear-gradient(135deg,#0f766e 0%,#115e59 100%)",
    color: "#f8fafc",
    border: "1px solid rgba(15,118,110,0.3)",
  },
  secondary: {
    background: "rgba(255,255,255,0.74)",
    color: "#0f172a",
    border: "1px solid rgba(15,23,42,0.12)",
  },
  ghost: {
    background: "transparent",
    color: "#0f172a",
    border: "1px solid rgba(15,23,42,0.08)",
  },
} satisfies Record<ButtonIntent, Record<string, string>>;

const sizeStyles = {
  sm: { padding: "0.55rem 0.85rem", fontSize: "0.875rem" },
  md: { padding: "0.75rem 1.1rem", fontSize: "0.95rem" },
  lg: { padding: "0.95rem 1.35rem", fontSize: "1rem" },
} satisfies Record<ButtonSize, Record<string, string>>;

export function Button({
  children,
  intent = "primary",
  size = "md",
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        borderRadius: "999px",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        cursor: props.disabled ? "not-allowed" : "pointer",
        boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
        opacity: props.disabled ? 0.6 : 1,
        transition: "transform 160ms ease, box-shadow 160ms ease",
        ...intentStyles[intent],
        ...sizeStyles[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
