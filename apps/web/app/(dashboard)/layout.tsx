import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="page-shell" style={{ paddingBlock: "1.25rem 2rem" }}>
      <AppShell user={session.user}>{children}</AppShell>
    </main>
  );
}
