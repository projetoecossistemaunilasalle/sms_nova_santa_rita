// Shared server actions for real and mock persistence.
export { signInAction } from "@/app/(professional)/entrar/actions";
export {
  requestPasswordResetAction,
  resetPasswordAction,
} from "@/app/(professional)/entrar/password-reset-actions";
export { signOutAction } from "@/app/(professional)/portal/sign-out-action";
export {
  assignOrganizationAdministratorAction,
  assignTeacherMembershipAction,
  assignTeacherToClassAction,
  changeClassStatusAction,
  changeMembershipAction,
  changeOrganizationStatusAction,
  createClassAction,
  createAccountAction,
  createOrganizationAction,
  deactivateTeacherAssignmentAction,
} from "@/app/(professional)/portal/adult-portal-actions";
export {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  showClassPlayerCredentialsAction,
  startClassSessionAction,
  setClassDefaultContentAction,
} from "@/app/(professional)/portal/player-access-actions";
export {
  importGameManifestAction,
  setCurrentGameManifestAction,
} from "@/app/(professional)/portal/game-content-actions";
export { resolvePlayerEntryAction } from "@/app/(public-play)/jogar/actions";
