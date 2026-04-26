import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InventoryHeatmap } from "@/components/supply-chain/inventory-heatmap";

describe("inventory heatmap", () => {
  it("renders accessible warehouse and product stock states", () => {
    render(
      <InventoryHeatmap
        dataset={{
          title: "Warehouse stock pressure",
          cells: [
            {
              warehouseId: "wh-1",
              warehouseName: "North Hub",
              productId: "p-1",
              productName: "Servo Kit",
              onHand: 8,
              reorderPoint: 12,
              available: 6,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Warehouse stock pressure")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/North Hub Servo Kit has 6 available units and reorder point 12/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Below reorder point/i)).toBeInTheDocument();
  });
});
