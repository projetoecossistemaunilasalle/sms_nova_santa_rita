import { ResultsScreen } from "@/components/portal/results-screen";
import { getResultReportsPageData } from "@runtime/game-events";

export const metadata = { title: "Resultados" };

export default async function ResultsPage() {
  const reports = await getResultReportsPageData();
  return <ResultsScreen reports={reports} />;
}
