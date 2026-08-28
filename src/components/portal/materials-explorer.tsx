"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";

import type { MaterialSummary } from "@/server/services/portal-view-service";
import { Icon } from "@/components/shared/icon";

import { StatusBadge } from "./status-badge";
import styles from "./portal.module.css";

export function MaterialsExplorer({
  materials,
}: {
  materials: MaterialSummary[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [audience, setAudience] = useState("Todos");
  const deferredQuery = useDeferredValue(
    query.trim().toLocaleLowerCase("pt-BR"),
  );

  const visibleMaterials = materials.filter((material) => {
    const matchesQuery =
      !deferredQuery ||
      `${material.title} ${material.theme} ${material.type}`
        .toLocaleLowerCase("pt-BR")
        .includes(deferredQuery);
    const matchesStatus = status === "Todos" || material.status === status;
    const matchesAudience =
      audience === "Todos" || material.audience === audience;
    return matchesQuery && matchesStatus && matchesAudience;
  });

  return (
    <>
      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <Icon name="search" />
          <span className={styles.srOnly}>Buscar materiais</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, tema ou tipo"
          />
        </label>
        <div className={styles.filterGroup}>
          <select
            className={styles.select}
            aria-label="Filtrar por público"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
          >
            <option>Todos</option>
            <option>Professores</option>
            <option>Famílias</option>
          </select>
          <select
            className={styles.select}
            aria-label="Filtrar por estado"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>Todos</option>
            <option>Publicado</option>
            <option>Rascunho</option>
            <option>Arquivado</option>
          </select>
        </div>
      </div>

      <p className={styles.resultCount} role="status">
        {visibleMaterials.length}{" "}
        {visibleMaterials.length === 1 ? "material" : "materiais"}
      </p>

      {visibleMaterials.length > 0 ? (
        <div className={styles.materialTable}>
          <div className={styles.materialTableHeader} aria-hidden="true">
            <span>Material</span>
            <span>Tipo e tema</span>
            <span>Público</span>
            <span>Estado</span>
            <span>Atualização</span>
            <span />
          </div>
          {visibleMaterials.map((material) => (
            <article className={styles.materialRow} key={material.id}>
              <span className={styles.materialIdentity}>
                <i
                  className={`${styles.materialMark} ${styles[`tone${material.accent.charAt(0).toUpperCase()}${material.accent.slice(1)}`]}`}
                >
                  <Icon name="book" />
                </i>
                <span>
                  <strong>{material.title}</strong>
                  <small>{material.summary}</small>
                </span>
              </span>
              <span className={styles.materialMeta}>
                <strong>{material.type}</strong>
                <small>{material.theme}</small>
              </span>
              <span className={styles.materialAudience}>
                {material.audience}
              </span>
              <StatusBadge status={material.status} />
              <span className={styles.materialMeta}>
                <strong>{material.updated}</strong>
                <small>{material.editor}</small>
              </span>
              <Link
                className={styles.iconButton}
                href={`/portal/materiais/${material.id}/editar`}
                aria-label={`Editar ${material.title}`}
              >
                <Icon name="edit" />
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.compactEmptyState}>
          <Icon name="search" />
          <h2>Nenhum material encontrado</h2>
          <p>Altere os filtros ou busque por outro termo.</p>
        </section>
      )}
    </>
  );
}
