import { TeamScreen } from "@/components/portal/team-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getTeamPageData } from "@/runtime/readers";
import { redirect } from "next/navigation";
import { AdultPortalError } from "@/application/adult-portal/errors";

export const metadata = { title: "Equipe" };

export default async function TeamAdminPage() {
  let data;
  try {
    data = await getTeamPageData();
  } catch (error) {
    if (error instanceof AdultPortalError && error.code === "FORBIDDEN") {
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
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
