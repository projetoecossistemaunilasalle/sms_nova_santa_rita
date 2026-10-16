import Link from "next/link";

import type {
  ClassReport,
  PlayerReport,
} from "@/application/game-events/ports";
import { Icon } from "@/components/shared/icon";
import { PageHeader } from "@/components/portal/page-header";
import { PortalState } from "@/components/portal/portal-state";
import { ClassResultsPlayers } from "./class-results-players";
import { formatActiveTime } from "./results-helpers";

import styles from "./results.module.css";

const numberFormat = new Intl.NumberFormat("pt-BR");
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

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
          headingLevel={2}
          icon="chart"
          title="Nenhum resultado sincronizado ainda"
          description="Quando uma turma iniciar uma sessão e o jogo enviar resultados, os totais de participação aparecerão aqui."
          actions={
            <Link className={styles.backLink} href="/portal/turmas">
              Ir para as turmas
            </Link>
          }
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
        description="Escolha uma turma para ver a participação e o tempo ativo de cada jogador."
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
        description="Abra um jogador para acompanhar suas sessões e os resultados sincronizados pelo jogo."
        actions={
          <>
            <Link className={styles.backLink} href="/portal/resultados">
              Voltar aos resultados
            </Link>
            <Link
              className={styles.backLink}
              href={`/portal/turmas/${report.classGroupId}`}
            >
              Acessos e sessão da turma
            </Link>
          </>
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
          headingLevel={2}
          icon="users"
          title="Esta turma ainda não tem jogadores"
          description="Os números de jogador aparecerão aqui depois que forem preparados para a turma."
          actions={
            <Link
              className={styles.backLink}
              href={`/portal/turmas/${report.classGroupId}`}
            >
              Preparar jogadores
            </Link>
          }
        />
      ) : (
        <ClassResultsPlayers key={report.classGroupId} report={report} />
      )}
    </>
  );
}

export function PlayerResultsScreen({ report }: { report: PlayerReport }) {
  const { history } = report;
  const historyUrl = (sessionPage: number, resultPage = 1) =>
    `/portal/resultados/${report.classGroupId}/players/${report.playerSlotId}?sessionPage=${sessionPage}&resultPage=${resultPage}`;
  return (
    <>
      <PageHeader
        eyebrow={`${report.className} / Resultados`}
        title={`Jogador ${String(report.playerNumber).padStart(2, "0")}`}
        description="Histórico de sessões, tempo ativo e campos de resultado fornecidos pelo jogo."
        actions={
          <Link
            className={styles.backLink}
            href={`/portal/resultados/${report.classGroupId}`}
          >
            Voltar aos resultados da turma
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
      {history.sessionPages > 1 && (
        <nav
          className={styles.pagination}
          aria-label="Páginas do histórico de sessões"
        >
          {history.sessionPage > 1 && (
            <Link
              className={styles.backLink}
              href={historyUrl(history.sessionPage - 1)}
            >
              Sessão mais recente
            </Link>
          )}
          <span>
            Sessão {history.sessionPage} de {history.sessionPages}
          </span>
          {history.sessionPage < history.sessionPages && (
            <Link
              className={styles.backLink}
              href={historyUrl(history.sessionPage + 1)}
            >
              Sessão mais antiga
            </Link>
          )}
        </nav>
      )}
      {report.participations.length === 0 ? (
        <PortalState
          headingLevel={2}
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
              {history.resultPages > 1 && (
                <nav
                  className={styles.pagination}
                  aria-label="Páginas de resultados desta sessão"
                >
                  {history.resultPage > 1 && (
                    <Link
                      className={styles.backLink}
                      href={historyUrl(
                        history.sessionPage,
                        history.resultPage - 1,
                      )}
                    >
                      Resultados mais recentes
                    </Link>
                  )}
                  <span>
                    Página {history.resultPage} de {history.resultPages}
                  </span>
                  {history.resultPage < history.resultPages && (
                    <Link
                      className={styles.backLink}
                      href={historyUrl(
                        history.sessionPage,
                        history.resultPage + 1,
                      )}
                    >
                      Resultados mais antigos
                    </Link>
                  )}
                </nav>
              )}
            </article>
          ))}
        </section>
      )}
    </>
  );
}
