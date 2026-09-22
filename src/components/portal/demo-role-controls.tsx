"use client";

import { useEffect, useState } from "react";

import {
  changeDemoProfile,
  resetDemoPortal,
} from "@runtime/adult-portal-client";
import {
  OrganizationRole,
  PlatformRole,
  RecordStatus,
} from "@/generated/prisma/enums";

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

  if (!state) return null;

  function roleLabel(profileId: string) {
    const profile = state?.profiles.find((item) => item.id === profileId);
    if (profile?.platformRole === PlatformRole.PLATFORM_ADMIN)
      return "Plataforma";
    const membership = state?.memberships.find(
      (item) =>
        item.profileId === profileId && item.status === RecordStatus.ACTIVE,
    );
    return membership?.role === OrganizationRole.ORGANIZATION_ADMIN
      ? "Organização"
      : "Professor";
  }

  return (
    <div className={styles.demoRoleControls}>
      <label>
        <span>Perfil demonstrado</span>
        <select
          value={state.activeProfileId}
          onChange={(event) => {
            changeDemoProfile(event.target.value);
            setNotice("Perfil demo alterado.");
          }}
        >
          {state.profiles.slice(0, 3).map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.displayName} · {roleLabel(profile.id)}
            </option>
          ))}
        </select>
      </label>
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
