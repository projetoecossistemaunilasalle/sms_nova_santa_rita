import { PlayerAccessService } from "@/application/player-access/service";
import {
  DEMO_CLASS_IDS,
  DEMO_PROFILE_IDS,
  DemoPlayerAccessStore,
} from "@/runtime/adult-portal-demo-store";

const unusedIssuer = {
  issue(): never {
    throw new Error("Static demo reads never issue player credentials.");
  },
};

export function getPlayerAccessPageData(classGroupId: string) {
  const profileId =
    classGroupId === DEMO_CLASS_IDS.FOURTH_A
      ? DEMO_PROFILE_IDS.SECOND_TEACHER
      : DEMO_PROFILE_IDS.ORGANIZATION_ADMIN;
  return new PlayerAccessService(
    new DemoPlayerAccessStore(),
    unusedIssuer,
  ).getClassWorkflow(profileId, classGroupId);
}
