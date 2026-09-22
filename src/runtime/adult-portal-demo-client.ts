"use client";

import {
  type DemoAdultPortalState,
  readDemoAdultPortalState,
  resetDemoAdultPortalState,
  setDemoActiveProfile,
} from "@/runtime/adult-portal-demo-store";

export function loadClientPortalState(): DemoAdultPortalState {
  return readDemoAdultPortalState();
}

export function changeDemoProfile(profileId: string): void {
  setDemoActiveProfile(profileId);
}

export function resetDemoPortal(): void {
  resetDemoAdultPortalState();
}
