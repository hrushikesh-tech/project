"use client";

import { useFieldArray } from "react-hook-form";
import { z } from "zod";

import { AppForm } from "@/components/forms/app-form";

import { Button, FormField } from "@amdox/ui";

const accountOptions = [
  "1000 Cash",
  "1200 Accounts Receivable",
  "2000 Accounts Payable",
  "4100 Revenue",
  "5100 Cost of Goods Sold",
  "6200 Payroll Expense",
];

const fxRates: Record<string, number> = {
  INR: 1,
  USD: 83.12,
  EUR: 90.44,
  AED: 22.63,
};

const journalSchema = z.object({
  description: z.string().min(5, "Description is required."),
  currency: z.enum(["INR", "USD", "EUR", "AED"]),
  exchangeRate: z.coerce.number().positive("FX rate must be positive."),
  lines: z
    .array(
      z.object({
        account: z.string().min(4, "Account is required."),
        memo: z.string().min(2, "Memo is required."),
        debit: z.coerce.number().min(0),
        credit: z.coerce.number().min(0),
      }),
    )
    .min(2, "At least two lines are required."),
});

type JournalFormValues = z.infer<typeof journalSchema>;

const defaultValues: JournalFormValues = {
  description: "April revenue accrual",
  currency: "USD",
  exchangeRate: fxRates.USD,
  lines: [
    { account: "1200 Accounts Receivable", memo: "Contract accrual", debit: 15000, credit: 0 },
    { account: "4100 Revenue", memo: "Contract accrual", debit: 0, credit: 15000 },
  ],
};

export function JournalEntryBuilder() {
  return (
    <AppForm<JournalFormValues>
      title="Journal entry builder"
      description="Dynamic lines, real-time balance, and FX preview are all visible before submission so finance users do not guess at accounting validity."
      schema={journalSchema}
      defaultValues={defaultValues}
      submitLabel="Save draft"
      onSubmit={async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }}
    >
      {(methods) => {
        const { fields, append, remove } = useFieldArray({
          control: methods.control,
          name: "lines",
        });
        const values = methods.watch();
        const debitTotal = values.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
        const creditTotal = values.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
        const imbalance = debitTotal - creditTotal;
        const convertedMinor = debitTotal * Number(values.exchangeRate || 1);

        return (
          <>
            <div className="grid-cards">
              <FormField
                id="description"
                label="Description"
                required
                error={methods.formState.errors.description?.message}
                inputProps={methods.register("description")}
              />
              <FormField
                id="currency"
                label="Currency"
                required
                error={methods.formState.errors.currency?.message}
                inputProps={{
                  ...methods.register("currency"),
                  list: "currency-options",
                }}
              />
              <datalist id="currency-options">
                <option value="INR" />
                <option value="USD" />
                <option value="EUR" />
                <option value="AED" />
              </datalist>
              <FormField
                id="exchangeRate"
                label="FX rate"
                required
                helpText="Preview uses home-currency INR equivalent."
                error={methods.formState.errors.exchangeRate?.message}
                inputProps={{
                  ...methods.register("exchangeRate"),
                  type: "number",
                  step: "0.01",
                }}
              />
            </div>

            <section className="surface" style={{ padding: "1rem", display: "grid", gap: "1rem", boxShadow: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div className="eyebrow">Balance indicator</div>
                  <h3 style={{ margin: "0.35rem 0" }}>{imbalance === 0 ? "Balanced" : "Needs attention"}</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    Debit {debitTotal.toLocaleString("en-IN")} | Credit {creditTotal.toLocaleString("en-IN")}
                  </p>
                </div>
                <div
                  className="pill"
                  style={{
                    background: imbalance === 0 ? "rgba(15,118,110,0.12)" : "rgba(185,28,28,0.1)",
                    color: imbalance === 0 ? "var(--brand-strong)" : "#b91c1c",
                  }}
                >
                  {imbalance === 0 ? "Ready to save" : `Out of balance by ${Math.abs(imbalance).toLocaleString("en-IN")}`}
                </div>
              </div>

              <div className="grid-cards">
                <article className="surface" style={{ padding: "1rem", boxShadow: "none" }}>
                  <div className="eyebrow">FX preview</div>
                  <strong>{convertedMinor.toLocaleString("en-IN", { maximumFractionDigits: 2 })} INR equivalent</strong>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Using {values.currency} at {values.exchangeRate}.
                  </p>
                </article>
                <article className="surface" style={{ padding: "1rem", boxShadow: "none" }}>
                  <div className="eyebrow">Validation guardrail</div>
                  <strong>{fields.length} lines in draft</strong>
                  <p className="muted" style={{ marginBottom: 0 }}>
                    Add at least two lines and keep debits equal to credits before posting.
                  </p>
                </article>
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns: "2fr 2fr 1fr 1fr auto",
                      alignItems: "end",
                    }}
                  >
                    <FormField
                      id={`lines.${index}.account`}
                      label="Account"
                      required
                      error={methods.formState.errors.lines?.[index]?.account?.message}
                      inputProps={{
                        ...methods.register(`lines.${index}.account`),
                        list: "account-options",
                      }}
                    />
                    <FormField
                      id={`lines.${index}.memo`}
                      label="Memo"
                      required
                      error={methods.formState.errors.lines?.[index]?.memo?.message}
                      inputProps={methods.register(`lines.${index}.memo`)}
                    />
                    <FormField
                      id={`lines.${index}.debit`}
                      label="Debit"
                      error={methods.formState.errors.lines?.[index]?.debit?.message}
                      inputProps={{
                        ...methods.register(`lines.${index}.debit`),
                        type: "number",
                        step: "0.01",
                      }}
                    />
                    <FormField
                      id={`lines.${index}.credit`}
                      label="Credit"
                      error={methods.formState.errors.lines?.[index]?.credit?.message}
                      inputProps={{
                        ...methods.register(`lines.${index}.credit`),
                        type: "number",
                        step: "0.01",
                      }}
                    />
                    <Button type="button" intent="ghost" onClick={() => remove(index)} disabled={fields.length <= 2}>
                      Remove
                    </Button>
                  </div>
                ))}
                <datalist id="account-options">
                  {accountOptions.map((account) => (
                    <option key={account} value={account} />
                  ))}
                </datalist>
              </div>

              <div>
                <Button
                  type="button"
                  intent="secondary"
                  onClick={() => append({ account: "", memo: "", debit: 0, credit: 0 })}
                >
                  Add line
                </Button>
              </div>
            </section>
          </>
        );
      }}
    </AppForm>
  );
}
