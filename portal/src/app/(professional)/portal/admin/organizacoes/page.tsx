import { OrganizationsScreen } from "@/components/portal/organizations-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getOrganizationsPageData } from "@/runtime/readers";

export const metadata = { title: "Organizações" };

export default async function OrganizationsPage() {
  const data = await getOrganizationsPageData();
  return (
    <OrganizationsScreen
      initialOrganizations={data.organizations}
      canCreate={data.canCreate}
      initialRole={data.role}
      runtimeMode={getRuntimeMode()}
    />
  );
}
