"use client";

import { useEffect, useState } from "react";

import {
  changeDemoProfile,
  resetDemoPortal,
} from "@runtime/adult-portal-client";
import { RecordStatus } from "@/generated/prisma/enums";
import type { DemoAdultPortalState } from "@/runtime/adult-portal-demo-store";

import {
  demoAssignedRoleForProfile,
  demoRoleForProfile,
} from "./adult-portal-helpers";
import { useDemoPortalState } from "./use-demo-portal";
import styles from "./portal.module.css";

export function DemoRoleControls() {
  const state = useDemoPortalState();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const demoState = state;
  if (!demoState) return null;

  const activeProfiles = demoState.profiles.filter(
    (profile) => profile.status === RecordStatus.ACTIVE,
  );
  const selectedProfileId = activeProfiles.some(
    (profile) => profile.id === demoState.activeProfileId,
  )
    ? demoState.activeProfileId
    : "";
  const selectedRole = selectedProfileId
    ? demoRoleForProfile(demoState, selectedProfileId)
    : null;
  const inactiveOrganization = demoState.memberships
    .filter(
      (membership) =>
        membership.profileId === selectedProfileId &&
        membership.status === RecordStatus.ACTIVE,
    )
    .map((membership) =>
      demoState.organizations.find(
        (organization) =>
          organization.id === membership.organizationId &&
          organization.status === RecordStatus.INACTIVE,
      ),
    )
    .find((organization) => organization !== undefined);

  function roleLabel(profileState: DemoAdultPortalState, profileId: string) {
    const role = demoAssignedRoleForProfile(profileState, profileId);
    return role === "platform_admin"
      ? "Plataforma"
      : role === "organization_admin"
        ? "Organização"
        : role === "teacher"
          ? "Professor"
          : "Sem vínculo";
  }

  return (
    <div className={styles.demoRoleControls}>
      <label>
        <span>Perfil demonstrado</span>
        <select
          value={selectedProfileId}
          onChange={(event) => {
            changeDemoProfile(event.target.value);
            setNotice("Perfil demo alterado.");
          }}
        >
          {!selectedProfileId && (
            <option value="" disabled>
              Selecione um perfil ativo
            </option>
          )}
          {activeProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.displayName} · {roleLabel(demoState, profile.id)}
            </option>
          ))}
        </select>
      </label>
      {selectedProfileId && !selectedRole && (
        <span className={styles.demoRoleBlockNotice} role="status">
          {inactiveOrganization
            ? `${inactiveOrganization.name} está inativa. Mude para Plataforma e reative-a, ou restaure o demo (isso apaga alterações locais).`
            : "Este perfil não tem vínculo ativo. Restaure o demo para recuperar os perfis de exemplo; suas alterações locais serão perdidas."}
        </span>
      )}
      <button
        type="button"
        onClick={() => {
          resetDemoPortal();
          setNotice("Dados demo restaurados.");
        }}
      >
        Restaurar demo
      </button>
      {notice && <span role="status">{notice}</span>}
    </div>
  );
}
