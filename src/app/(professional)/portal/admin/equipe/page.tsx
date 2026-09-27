import { TeamScreen } from "@/components/portal/team-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getTeamPageData } from "@/runtime/readers";

export const metadata = { title: "Equipe" };

export default async function TeamAdminPage() {
  const data = await getTeamPageData();
  return (
    <TeamScreen
      initialMembers={data.members}
      initialOrganizations={data.organizations}
      profiles={data.profiles}
      initialRole={data.role}
      runtimeMode={getRuntimeMode()}
    />
  );
}
