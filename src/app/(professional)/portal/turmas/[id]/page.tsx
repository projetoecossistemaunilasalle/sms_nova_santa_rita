import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { ClassDetailScreen } from "@/components/portal/class-detail-screen";
import { getRuntimeMode } from "@/runtime/mode";
import { getClassPageData, listStaticClassIds } from "@runtime/adult-portal";
import { getPlayerAccessPageData } from "@runtime/player-access";

export const metadata = { title: "Detalhe da turma" };

export function generateStaticParams() {
  return listStaticClassIds().map((id) => ({ id }));
}

export default async function ClassGroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let classGroup;
  let playerAccess;
  try {
    [classGroup, playerAccess] = await Promise.all([
      getClassPageData(id),
      getPlayerAccessPageData(id),
    ]);
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  return (
    <ClassDetailScreen
      initialClass={classGroup}
      initialWorkflow={playerAccess}
      runtimeMode={getRuntimeMode()}
    />
  );
}
