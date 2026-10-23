"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { changeMockProfile, resetMockWorkspace } from "@/server/mock/actions";
import styles from "./portal.module.css";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? "Aguarde..." : children}
    </button>
  );
}

export function MockWorkspaceControls({
  profiles,
  activeProfileId,
}: {
  profiles: { id: string; displayName: string; roleLabel: string }[];
  activeProfileId: string;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <details
      className={styles.mockWorkspaceControls}
      aria-label="Ambiente de demonstração"
    >
      <summary>
        <strong>Demonstração local</strong>
        <span>
          {
            profiles.find((profile) => profile.id === activeProfileId)
              ?.displayName
          }
        </span>
        <span className={styles.demoSettingsLabel}>Perfis e opções</span>
      </summary>
      <div className={styles.demoSettings}>
        <p>
          Dados fictícios isolados nesta sessão. Expiram em 8 horas, ao sair ou
          ao reiniciar o servidor.
        </p>
        <form action={changeMockProfile} key={activeProfileId}>
          <label>
            <span>Perfil demonstrado</span>
            <select name="profileId" defaultValue={activeProfileId}>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName} · {profile.roleLabel}
                </option>
              ))}
            </select>
          </label>
          <Submit>Trocar perfil</Submit>
        </form>
        <div>
          {confirmReset ? (
            <form action={resetMockWorkspace}>
              <span>Apagar as alterações desta sessão?</span>
              <Submit>Confirmar restauração</Submit>
              <button type="button" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmReset(true)}>
              Restaurar demo
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
