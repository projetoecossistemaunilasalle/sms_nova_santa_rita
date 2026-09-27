// Concrete demo variant for the generated actions entry. In the demo target
// these are ordinary browser-callable functions, so this barrel and the
// generated consumer entry stay directive-free.
export { signInAction, signOutAction } from "@/runtime/demo-auth-actions";
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
} from "@/runtime/adult-portal-demo-actions";
export {
  allocatePlayerSlotsAction,
  endClassSessionAction,
  rotatePlayerCredentialAction,
  startClassSessionAction,
} from "@/runtime/player-access-demo-actions";
export { resolvePlayerEntryAction } from "@/runtime/player-entry-demo-actions";
