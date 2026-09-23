import Link from "next/link";

import type {
  ClassReport,
  PlayerReport,
} from "@/application/game-events/ports";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/portal/page-header";
import { PortalState } from "@/components/portal/portal-state";

import styles from "./results.module.css";

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatActiveTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${minutes} min`;
  if (minutes > 0) return `${minutes} min ${seconds} s`;
  return `${seconds} s`;
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function ResultsScreen({ reports }: { reports: ClassReport[] }) {
  if (reports.length === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Resultados"
          title="Participação em jogo"
          description="Resultados registrados pelo jogo e tempo ativo significativo, organizados por turma e número de jogador."
        />
        <PortalState
          icon="chart"
          title="Nenhum resultado sincronizado ainda"
          description="Quando uma turma iniciar uma sessão e o jogo enviar resultados, os totais de participação aparecerão aqui."
        />
      </>
    );
  }

  const playerCount = reports.reduce(
    (total, report) => total + report.participatingPlayerCount,
    0,
  );
  const activeTimeMs = reports.reduce(
    (total, report) => total + report.totalActiveMs,
    0,
  );
  const resultCount = reports.reduce(
    (total, report) => total + report.resultCount,
    0,
  );

  return (
    <>
      <PageHeader
        eyebrow="Resultados"
        title="Participação em jogo"
        description="Tempo ativo e eventos de resultado aceitos pelo servidor, separados por turma."
      />
      <section className={styles.summaryStrip} aria-label="Resumo das turmas">
        <SummaryCard
          label="Turmas"
          value={numberFormat.format(reports.length)}
          note="No seu escopo"
        />
        <SummaryCard
          label="Jogadores"
          value={numberFormat.format(playerCount)}
          note="Com participação"
        />
        <SummaryCard
          label="Tempo ativo"
          value={formatActiveTime(activeTimeMs)}
          note="Somado das sessões"
        />
        <SummaryCard
          label="Resultados"
          value={numberFormat.format(resultCount)}
          note="Eventos registrados"
        />
      </section>
      <section className={styles.classList} aria-label="Resultados por turma">
        {reports.map((report) => (
          <Link
            className={styles.classCard}
            href={`/portal/resultados/${report.classGroupId}`}
            key={report.classGroupId}
          >
            <span className={styles.classMark} aria-hidden="true">
              <Icon name="school" />
            </span>
            <span className={styles.classContent}>
              <strong>{report.className}</strong>
              <small>
                {numberFormat.format(report.participatingPlayerCount)} jogadores
                · {numberFormat.format(report.sessionCount)} sessões ·{" "}
                {numberFormat.format(report.resultCount)} resultados
              </small>
            </span>
            <span className={styles.classTime}>
              <small>Tempo ativo</small>
              <strong>{formatActiveTime(report.totalActiveMs)}</strong>
            </span>
            <Icon name="chevron" />
          </Link>
        ))}
      </section>
    </>
  );
}

export function ClassResultsScreen({ report }: { report: ClassReport }) {
  return (
    <>
      <PageHeader
        eyebrow="Resultados / Turma"
        title={report.className}
        description="Participação por número de jogador. Os valores exibidos vêm dos eventos aceitos pelo servidor."
        actions={
          <Link className={styles.backLink} href="/portal/resultados">
            Voltar aos resultados
          </Link>
        }
      />
      <section className={styles.summaryStrip} aria-label="Resumo da turma">
        <SummaryCard
          label="Jogadores"
          value={numberFormat.format(report.participatingPlayerCount)}
          note={`De ${numberFormat.format(report.playerCount)} números`}
        />
        <SummaryCard
          label="Sessões"
          value={numberFormat.format(report.sessionCount)}
          note="Com participação"
        />
        <SummaryCard
          label="Tempo ativo"
          value={formatActiveTime(report.totalActiveMs)}
          note="Somado das sessões"
        />
        <SummaryCard
          label="Resultados"
          value={numberFormat.format(report.resultCount)}
          note="Eventos registrados"
        />
      </section>
      {report.players.length === 0 ? (
        <PortalState
          icon="users"
          title="Esta turma ainda não tem jogadores"
          description="Os números de jogador aparecerão aqui depois que forem preparados para a turma."
        />
      ) : (
        <section className={styles.reportPanel} aria-label="Jogadores da turma">
          <div className={styles.reportPanelHeader}>
            <div>
              <h2>Jogadores numerados</h2>
              <p>Sem nomes ou dados pessoais de crianças.</p>
            </div>
            <span>{numberFormat.format(report.players.length)} números</span>
          </div>
          <div className={styles.tableScroll}>
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
                {report.players.map((player) => (
                  <tr key={player.playerSlotId}>
                    <th scope="row">
                      <Link
                        className={styles.playerLink}
                        href={`/portal/resultados/${report.classGroupId}/players/${player.playerSlotId}`}
                      >
                        <span className={styles.playerNumber}>
                          {String(player.playerNumber).padStart(2, "0")}
                        </span>
                        <span>
                          Player {String(player.playerNumber).padStart(2, "0")}
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
        </section>
      )}
    </>
  );
}

export function PlayerResultsScreen({ report }: { report: PlayerReport }) {
  return (
    <>
      <PageHeader
        eyebrow={`${report.className} / Resultados`}
        title={`Player ${String(report.playerNumber).padStart(2, "0")}`}
        description="Histórico de sessões, tempo ativo e campos de resultado fornecidos pelo jogo."
        actions={
          <Link
            className={styles.backLink}
            href={`/portal/resultados/${report.classGroupId}`}
          >
            Voltar à turma
          </Link>
        }
      />
      <section className={styles.summaryStrip} aria-label="Resumo do jogador">
        <SummaryCard
          label="Sessões"
          value={numberFormat.format(report.participationCount)}
          note="Com participação"
        />
        <SummaryCard
          label="Tempo ativo"
          value={formatActiveTime(report.totalActiveMs)}
          note="Tempo significativo informado pelo jogo"
        />
        <SummaryCard
          label="Resultados"
          value={numberFormat.format(report.resultCount)}
          note="Eventos registrados"
        />
      </section>
      {report.participations.length === 0 ? (
        <PortalState
          icon="history"
          title="Nenhuma sessão registrada"
          description="Quando este número entrar em uma sessão de jogo, o histórico aparecerá aqui."
        />
      ) : (
        <section
          className={styles.sessionList}
          aria-label="Histórico de sessões"
        >
          {report.participations.map((participation) => (
            <article
              className={styles.sessionCard}
              key={participation.gameSessionId}
            >
              <header className={styles.sessionHeader}>
                <div>
                  <span className={styles.sessionEyebrow}>Sessão</span>
                  <h2>{dateFormat.format(participation.sessionStartedAt)}</h2>
                  <p>
                    {participation.sessionEndedAt
                      ? `Encerrada em ${dateFormat.format(participation.sessionEndedAt)}`
                      : "Em andamento"}
                  </p>
                </div>
                <div className={styles.sessionTotals}>
                  <span>
                    {formatActiveTime(participation.activeTimeMs)} ativos
                  </span>
                  <span>
                    {numberFormat.format(participation.resultCount)} resultados
                  </span>
                </div>
              </header>
              {participation.results.length > 0 ? (
                <div className={styles.resultList}>
                  {participation.results.map((result) => (
                    <article className={styles.resultEvent} key={result.id}>
                      <div className={styles.resultTitle}>
                        <span>{result.activityId}</span>
                        <strong>{result.state.replaceAll("_", " ")}</strong>
                      </div>
                      <p>
                        Missão {result.missionId} ·{" "}
                        {formatActiveTime(result.durationMs)} · recebido{" "}
                        {dateFormat.format(result.receivedAt)}
                      </p>
                      {Object.keys(result.metrics).length > 0 && (
                        <dl className={styles.metricList}>
                          {Object.entries(result.metrics).map(
                            ([key, value]) => (
                              <div key={key}>
                                <dt>{key}</dt>
                                <dd>{numberFormat.format(value)}</dd>
                              </div>
                            ),
                          )}
                        </dl>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.noEvents}>
                  Ainda não há eventos de resultado nesta sessão.
                </p>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
