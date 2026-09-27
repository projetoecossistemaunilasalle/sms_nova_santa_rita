// Concrete server variant for the generated actions entry. Grouped by
// responsibility; the implementations stay in their dedicated "use server"
// files. Only reachable from the server target's generated entry.
export { signInAction } from "@/app/(professional)/entrar/actions";
export { signOutAction } from "@/app/(professional)/portal/sign-out-action";
export {
  assignOrganizationAdministratorAction,
  assignTeacherMembershipAction,
  assignTeacherToClassAction,
  changeClassStatusAction,
  changeMembershipAction,
  changeOrganizationStatusAction,
  createClassAction,
  createDemoProfessionalAction,
  createOrganizationAction,
  deactivateTeacherAssignmentAction,
} from "@/app/(professional)/portal/adult-portal-actions";
export {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  startClassSessionAction,
} from "@/app/(professional)/portal/player-access-actions";
export { resolvePlayerEntryAction } from "@/app/(public-play)/jogar/actions";
