import type { InputHTMLAttributes } from "react";

export type FormFieldProps = {
  id: string;
  label: string;
  helpText?: string;
  error?: string;
  required?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
};

export function FormField({
  id,
  label,
  helpText,
  error,
  required = false,
  inputProps,
}: FormFieldProps) {
  const describedBy = [helpText ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ display: "grid", gap: "0.45rem" }}>
      <label htmlFor={id} style={{ fontWeight: 700, color: "#0f172a" }}>
        {label}
        {required ? (
          <span style={{ color: "#b91c1c", marginInlineStart: "0.35rem" }} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        {...inputProps}
        style={{
          width: "100%",
          borderRadius: "14px",
          border: `1px solid ${error ? "rgba(185,28,28,0.35)" : "rgba(15,23,42,0.12)"}`,
          background: "#fff",
          color: "#0f172a",
          padding: "0.8rem 0.95rem",
          outline: "none",
          boxShadow: error ? "0 0 0 4px rgba(185,28,28,0.08)" : "none",
          ...(inputProps?.style ?? {}),
        }}
      />
      {helpText ? (
        <p id={`${id}-help`} style={{ margin: 0, color: "#64748b", lineHeight: 1.5, fontSize: "0.9rem" }}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} style={{ margin: 0, color: "#b91c1c", fontWeight: 600, fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
