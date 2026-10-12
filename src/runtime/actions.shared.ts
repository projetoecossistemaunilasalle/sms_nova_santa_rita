// Shared server actions for real and mock persistence.
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
  createOrganizationAction,
  deactivateTeacherAssignmentAction,
} from "@/app/(professional)/portal/adult-portal-actions";
export {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  showClassPlayerCredentialsAction,
  startClassSessionAction,
} from "@/app/(professional)/portal/player-access-actions";
export { resolvePlayerEntryAction } from "@/app/(public-play)/jogar/actions";
