import { notFound, redirect } from "next/navigation";

import { AdultPortalError } from "@/application/adult-portal/errors";
import { ClassResultsScreen } from "@/components/portal/results-screen";
import {
  buildModuleOptions,
  parseModuleParam,
} from "@/components/portal/results-helpers";
import {
  getClassContentPageData,
  getClassResultsPageData,
} from "@/runtime/readers";

export const metadata = { title: "Resultados da turma" };

export default async function ClassResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ classGroupId: string }>;
  searchParams: Promise<{ modulo?: string | string[] }>;
}) {
  const { classGroupId } = await params;
  const moduleId = parseModuleParam((await searchParams).modulo);
  let report;
  try {
    report = await getClassResultsPageData(classGroupId, moduleId);
  } catch (error) {
    if (error instanceof AdultPortalError) {
      if (error.code === "NOT_FOUND") notFound();
      redirect("/portal/sem-acesso");
    }
    throw error;
  }
  if (!report) notFound();
  // Module titles come from the current manifest; the filter still works
  // (labelled by id) when the content catalog is unavailable.
  const content = await getClassContentPageData(classGroupId).catch(() => null);
  const moduleOptions = buildModuleOptions(
    (content?.modules ?? []).map((item) => ({
      id: item.module_id,
      label: item.title,
    })),
    report.moduleTotals,
    moduleId,
  );
  return (
    <ClassResultsScreen
      report={report}
      moduleOptions={moduleOptions}
      moduleId={moduleId}
    />
  );
}
