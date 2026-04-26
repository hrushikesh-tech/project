"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { type DefaultValues, type FieldValues, FormProvider, useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Button } from "@amdox/ui";

type AppFormProps<TValues extends FieldValues> = {
  title: string;
  description?: string;
  schema: z.ZodTypeAny;
  defaultValues: DefaultValues<TValues>;
  submitLabel: string;
  successMessage?: string | null;
  onSubmit: (values: TValues) => Promise<void> | void;
  children: (methods: UseFormReturn<TValues>) => ReactNode;
};

export function AppForm<TValues extends FieldValues>({
  title,
  description,
  schema,
  defaultValues,
  submitLabel,
  successMessage = "Saved successfully.",
  onSubmit,
  children,
}: AppFormProps<TValues>) {
  const methods = useForm<TValues>({
    resolver: zodResolver(schema as never),
    defaultValues,
    mode: "onChange",
  });
  const [status, setStatus] = useState<string | null>(null);

  const {
    formState: { isDirty, isSubmitting, isValid },
    handleSubmit,
    reset,
  } = methods;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={handleSubmit(async (values) => {
          await onSubmit(values as TValues);
          setStatus(successMessage ?? null);
          reset(values);
        })}
        className="surface"
        style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}
      >
        <header>
          <div className="eyebrow">Operational form</div>
          <h2 style={{ marginBottom: "0.35rem" }}>{title}</h2>
          {description ? (
            <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {description}
            </p>
          ) : null}
        </header>

        {isDirty ? (
          <div
            style={{
              borderRadius: "16px",
              background: "rgba(15,118,110,0.08)",
              color: "var(--brand-strong)",
              padding: "0.8rem 0.95rem",
              fontWeight: 600,
            }}
          >
            Unsaved changes are waiting to be submitted.
          </div>
        ) : null}

        {children(methods)}

        {status ? (
          <div
            style={{
              borderRadius: "16px",
              background: "rgba(15,118,110,0.08)",
              color: "var(--brand-strong)",
              padding: "0.8rem 0.95rem",
              fontWeight: 600,
            }}
          >
            {status}
          </div>
        ) : null}

        <footer style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
          <span className="muted">RHF + Zod validation, disabled submit, and dirty-state messaging are shared here.</span>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? "Saving..." : submitLabel}
          </Button>
        </footer>
      </form>
    </FormProvider>
  );
}
