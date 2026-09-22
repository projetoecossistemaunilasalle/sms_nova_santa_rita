import { ClassesScreen } from "@/components/portal/classes-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getClassesPageData } from "@runtime/adult-portal";

export const metadata = { title: "Turmas" };

export default async function ClassGroupsPage() {
  const data = await getClassesPageData();
  return (
    <ClassesScreen
      initialClasses={data.classes}
      initialOrganizations={data.organizations}
      initialRole={data.role}
      runtimeMode={getRuntimeMode()}
    />
  );
}
