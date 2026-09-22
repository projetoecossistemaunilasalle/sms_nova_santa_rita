"use client";

import { useEffect, useState } from "react";

import type { DemoAdultPortalState } from "@/runtime/adult-portal-demo-store";
import { loadClientPortalState } from "@runtime/adult-portal-client";

export function useDemoPortalState(): DemoAdultPortalState | null {
  const [state, setState] = useState<DemoAdultPortalState | null>(null);

  useEffect(() => {
    const sync = () => setState(loadClientPortalState());
    sync();
    window.addEventListener("adult-portal-demo-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("adult-portal-demo-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return state;
}
