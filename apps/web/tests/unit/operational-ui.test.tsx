import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { AppDataTable } from "@/components/data-table/app-data-table";
import { JournalEntryBuilder } from "@/components/finance/journal-entry-builder";
import { AppForm } from "@/components/forms/app-form";

import { FormField } from "@amdox/ui";

const columns: ColumnDef<{ code: string; name: string }>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Name" },
];

describe("operational data table", () => {
  it("filters rows through the shared global search input", async () => {
    const user = userEvent.setup();

    render(
      <AppDataTable
        title="Ledger"
        columns={columns}
        data={[
          { code: "1000", name: "Cash" },
          { code: "2000", name: "Accounts Payable" },
        ]}
      />,
    );

    await user.type(screen.getByLabelText(/ledger search/i), "cash");

    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.queryByText("Accounts Payable")).not.toBeInTheDocument();
  });
});

describe("operational form", () => {
  it("shows dirty-state messaging before submit", async () => {
    const user = userEvent.setup();
    const schema = z.object({
      description: z.string().min(2),
    });

    render(
      <AppForm
        title="Preference form"
        schema={schema}
        defaultValues={{ description: "ok" }}
        submitLabel="Save"
        onSubmit={() => undefined}
      >
        {(methods) => (
          <FormField
            id="description"
            label="Description"
            inputProps={methods.register("description")}
          />
        )}
      </AppForm>,
    );

    await user.clear(screen.getByLabelText("Description"));
    await user.type(screen.getByLabelText("Description"), "updated");

    expect(screen.getByText(/unsaved changes are waiting to be submitted/i)).toBeInTheDocument();
  });

  it("keeps submit disabled while shared schema validation is failing", async () => {
    const user = userEvent.setup();
    const schema = z.object({
      description: z.string().min(2, "Description must contain at least 2 characters."),
    });

    render(
      <AppForm
        title="Preference form"
        schema={schema}
        defaultValues={{ description: "ok" }}
        submitLabel="Save"
        onSubmit={() => undefined}
      >
        {(methods) => (
          <FormField
            id="description-invalid"
            label="Description"
            error={methods.formState.errors.description?.message}
            inputProps={methods.register("description")}
          />
        )}
      </AppForm>,
    );

    const button = screen.getByRole("button", { name: /save/i });
    await user.clear(screen.getByLabelText("Description"));

    expect(button).toBeDisabled();
    expect(
      screen.getByText(/description must contain at least 2 characters/i),
    ).toBeInTheDocument();
  });
});

describe("journal entry builder", () => {
  it("updates the balance indicator in real time", async () => {
    const user = userEvent.setup();

    render(<JournalEntryBuilder />);

    expect(screen.getByText(/balanced/i)).toBeInTheDocument();

    const firstDebitInput = screen.getAllByLabelText("Debit")[0];
    await user.clear(firstDebitInput);
    await user.type(firstDebitInput, "17000");

    expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/out of balance by 2,000/i)).toBeInTheDocument();
  });
});

vi.stubGlobal("URL", {
  createObjectURL: vi.fn(() => "blob:test"),
  revokeObjectURL: vi.fn(),
});
