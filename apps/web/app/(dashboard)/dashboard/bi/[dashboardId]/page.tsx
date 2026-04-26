import { DashboardBuilder } from "@/components/bi/dashboard-builder";

export default async function DashboardBuilderPage({
  params,
}: {
  params: Promise<{ dashboardId: string }>;
}) {
  const { dashboardId } = await params;
  return <DashboardBuilder dashboardId={dashboardId} />;
}
