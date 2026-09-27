// Concrete server variant for the generated readers entry: page and
// static-param readers for the server target.
export {
  getClassPageData,
  getClassesPageData,
  getOrganizationPageData,
  getOrganizationsPageData,
  getPortalOverviewData,
  getPortalShellData,
  getTeamPageData,
  listStaticClassIds,
  listStaticOrganizationIds,
} from "@/runtime/adult-portal-server";
export { getPlayerAccessPageData } from "@/runtime/player-access-server";
export {
  getClassResultsPageData,
  getPlayerResultsPageData,
  getResultReportsPageData,
  listStaticResultClassIds,
  listStaticResultPlayerParams,
} from "@/runtime/game-events-server";
