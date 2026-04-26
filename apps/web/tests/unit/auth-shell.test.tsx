import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveRoleHome } from "@/lib/auth/role-home";
import { Topbar } from "@/components/shell/topbar";
import LoginPage from "../../app/(auth)/login/page";

const { push, refresh, signIn } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getCsrfToken: vi.fn(async () => "csrf-token"),
  signIn,
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

describe("role-home resolution", () => {
  it("prefers finance manager home for finance users", () => {
    const roleHome = resolveRoleHome(["viewer", "finance_manager"]);

    expect(roleHome.title).toContain("Finance");
    expect(roleHome.href).toBe("/dashboard");
  });

  it("falls back to viewer home when no known role is present", () => {
    const roleHome = resolveRoleHome([]);

    expect(roleHome.key).toBe("viewer");
  });
});

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  signIn.mockReset();
});

describe("topbar shell", () => {
  it("renders tenant, roles, and sign-out action", () => {
    render(
      <Topbar
        email="finance.phase12@amdox.dev"
        roles={["finance_manager", "viewer"]}
        tenantId="tenant-india"
      />,
    );

    expect(screen.getByText("finance.phase12@amdox.dev")).toBeInTheDocument();
    expect(screen.getByText("tenant-india")).toBeInTheDocument();
    expect(screen.getByText(/finance_manager, viewer/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

describe("login form", () => {
  it("blocks invalid login input before attempting sign-in", async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ error: undefined });

    render(<LoginPage />);

    const usernameInput = await screen.findByLabelText(/username/i);
    const button = screen.getByRole("button", { name: /sign in/i });
    expect(button).toBeDisabled();

    await user.type(usernameInput, "finance.phase12@amdox.dev");

    expect(button).toBeDisabled();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("submits valid credentials through the credentials provider", async () => {
    const user = userEvent.setup();
    signIn.mockResolvedValue({ error: undefined });

    render(<LoginPage />);

    const usernameInput = await screen.findByLabelText(/username/i);
    const passwordInput = await screen.findByLabelText(/password/i);

    await user.type(usernameInput, "finance.phase12@amdox.dev");
    await user.type(passwordInput, "Finance@123456");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({
          csrfToken: "csrf-token",
          username: "finance.phase12@amdox.dev",
          password: "Finance@123456",
          redirect: false,
        }),
      );
    });
    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(refresh).toHaveBeenCalled();
  });
});
