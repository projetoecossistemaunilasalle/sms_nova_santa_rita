import { OverviewScreen } from "@/components/portal/overview-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getPortalOverviewData } from "@runtime/adult-portal";

export default async function PortalDashboard() {
  const overview = await getPortalOverviewData();
  return <OverviewScreen initial={overview} runtimeMode={getRuntimeMode()} />;
}
