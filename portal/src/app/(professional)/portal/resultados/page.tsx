import { ResultsScreen } from "@/components/portal/results-screen";
import { getResultReportsPageData } from "@/runtime/readers";

export const metadata = { title: "Resultados" };

export default async function ResultsPage() {
  const reports = await getResultReportsPageData();
  return <ResultsScreen reports={reports} />;
}
