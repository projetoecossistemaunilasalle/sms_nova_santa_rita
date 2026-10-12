"use client";

import Link from "next/link";
import type { ClassReport } from "@/application/game-events/ports";
import { Icon } from "@/components/shared/icon";
import {
  filterReportPlayers,
  formatActiveTime,
  type ParticipationFilter,
} from "./results-helpers";
import portalStyles from "./portal.module.css";
import styles from "./results.module.css";
import { usePortalFilters } from "./use-portal-filters";

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function ClassResultsPlayers({ report }: { report: ClassReport }) {
  const { params, setFilters } = usePortalFilters();
  const query = params.get("player") ?? "";
  const participation: ParticipationFilter =
    params.get("participation") === "none"
      ? "none"
      : params.get("participation") === "recorded"
        ? "recorded"
        : "all";
  const players = filterReportPlayers(report.players, query, participation);
  const withoutParticipation = report.players.filter(
    (player) => player.participationCount === 0,
  ).length;
  const filters: {
    value: ParticipationFilter;
    label: string;
    count: number;
  }[] = [
    { value: "all", label: "Todos", count: report.players.length },
    {
      value: "recorded",
      label: "Com participação",
      count: report.players.length - withoutParticipation,
    },
    { value: "none", label: "Sem participação", count: withoutParticipation },
  ];

  return (
    <section className={styles.reportPanel} aria-label="Jogadores da turma">
      <div className={styles.reportPanelHeader}>
        <div>
          <h2>Jogadores numerados</h2>
          <p>
            Consulte um número ou encontre quem ainda não tem participação
            registrada.
          </p>
        </div>
      </div>
      <div className={styles.playerFilters}>
        <div
          className={styles.participationFilters}
          role="group"
          aria-label="Filtrar por participação"
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={participation === filter.value}
              onClick={() => setFilters({ participation: filter.value })}
            >
              {filter.label} <span>{filter.count}</span>
            </button>
          ))}
        </div>
        <label className={portalStyles.field}>
          <span>Número do jogador</span>
          <input
            className={portalStyles.input}
            type="search"
            inputMode="numeric"
            value={query}
            placeholder="Ex.: 07"
            onChange={(event) => setFilters({ player: event.target.value })}
          />
        </label>
        <p className={styles.filterNote}>
          Todo o histórico da turma. Ausência de registros não confirma ausência
          na aula; pode haver dados ainda não sincronizados.
        </p>
        <span className={styles.filterCount} role="status">
          {players.length} de {report.players.length} jogadores
        </span>
      </div>
      {players.length === 0 ? (
        <div className={styles.filteredEmpty}>
          <h3>Nenhum jogador neste filtro</h3>
          <p>Tente outro número ou volte à lista completa da turma.</p>
          <button
            type="button"
            className={portalStyles.buttonSecondary}
            onClick={() => {
              setFilters({ player: "", participation: "" });
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          <p className={styles.tableHint}>
            Deslize a tabela para ver todas as colunas.
          </p>
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Participação dos jogadores; role horizontalmente para ver todas as colunas"
          >
            <table className={styles.playerTable}>
              <thead>
                <tr>
                  <th scope="col">Jogador</th>
                  <th scope="col">Sessões</th>
                  <th scope="col">Tempo ativo</th>
                  <th scope="col">Resultados</th>
                  <th scope="col">Última atividade</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.playerSlotId}>
                    <th scope="row">
                      <Link
                        className={styles.playerLink}
                        href={`/portal/resultados/${report.classGroupId}/players/${player.playerSlotId}`}
                      >
                        <span
                          className={styles.playerNumber}
                          aria-hidden="true"
                        >
                          {String(player.playerNumber).padStart(2, "0")}
                        </span>
                        <span>
                          Jogador {String(player.playerNumber).padStart(2, "0")}
                        </span>
                        <Icon name="chevron" />
                      </Link>
                    </th>
                    <td>{numberFormat.format(player.participationCount)}</td>
                    <td>{formatActiveTime(player.totalActiveMs)}</td>
                    <td>{numberFormat.format(player.resultCount)}</td>
                    <td>
                      {player.lastPlayedAt
                        ? dateFormat.format(player.lastPlayedAt)
                        : "Sem atividade"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
