import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { ClassResultsScreen } from "@/components/portal/results-screen";
import {
  getClassResultsPageData,
  listStaticResultClassIds,
} from "@runtime/game-events";

export const metadata = { title: "Resultados da turma" };

export function generateStaticParams() {
  return listStaticResultClassIds().map((classGroupId) => ({ classGroupId }));
}

export default async function ClassResultsPage({
  params,
}: {
  params: Promise<{ classGroupId: string }>;
}) {
  const { classGroupId } = await params;
  let report;
  try {
    report = await getClassResultsPageData(classGroupId);
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  if (!report) notFound();
  return <ClassResultsScreen report={report} />;
}
