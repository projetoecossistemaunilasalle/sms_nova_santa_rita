import styles from "@/components/portal/portal.module.css";

const loadingRows = ["one", "two", "three", "four"];

export default function Loading() {
  return (
    <section
      className={styles.portalLoading}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={styles.portalLoadingMessage}>
        Carregando o conteúdo do portal.
      </span>

      <header className={styles.portalLoadingHeader} aria-hidden="true">
        <span
          className={`${styles.portalSkeleton} ${styles.portalLoadingEyebrow}`}
        />
        <span
          className={`${styles.portalSkeleton} ${styles.portalLoadingTitle}`}
        />
        <span
          className={`${styles.portalSkeleton} ${styles.portalLoadingDescription}`}
        />
      </header>

      <div className={styles.portalLoadingGrid} aria-hidden="true">
        <div
          className={`${styles.portalLoadingPanel} ${styles.portalLoadingFeaturePanel}`}
        >
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingBadge}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingFeatureTitle}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingLine} ${styles.portalLoadingLineLong}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingLine} ${styles.portalLoadingLineShort}`}
          />
          <div className={styles.portalLoadingActions}>
            <span
              className={`${styles.portalSkeleton} ${styles.portalLoadingAction}`}
            />
            <span
              className={`${styles.portalSkeleton} ${styles.portalLoadingActionSecondary}`}
            />
          </div>
        </div>

        <div
          className={`${styles.portalLoadingPanel} ${styles.portalLoadingWeeklyPanel}`}
        >
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingLabel}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingNumber}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingLine} ${styles.portalLoadingLineMedium}`}
          />
          <div className={styles.portalLoadingBars}>
            {loadingRows.slice(0, 4).map((row) => (
              <span
                className={`${styles.portalSkeleton} ${styles.portalLoadingBar}`}
                key={row}
              />
            ))}
          </div>
        </div>
      </div>

      <div className={styles.portalLoadingSummary} aria-hidden="true">
        {loadingRows.map((row) => (
          <div className={styles.portalLoadingSummaryCard} key={row}>
            <span
              className={`${styles.portalSkeleton} ${styles.portalLoadingSummaryLabel}`}
            />
            <span
              className={`${styles.portalSkeleton} ${styles.portalLoadingSummaryValue}`}
            />
            <span
              className={`${styles.portalSkeleton} ${styles.portalLoadingSummaryNote}`}
            />
          </div>
        ))}
      </div>

      <div className={styles.portalLoadingSection} aria-hidden="true">
        <div className={styles.portalLoadingSectionHeader}>
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingSectionTitle}`}
          />
          <span
            className={`${styles.portalSkeleton} ${styles.portalLoadingSectionLink}`}
          />
        </div>
        <div className={styles.portalLoadingList}>
          {loadingRows.map((row) => (
            <div className={styles.portalLoadingRow} key={row}>
              <div className={styles.portalLoadingIdentity}>
                <span
                  className={`${styles.portalSkeleton} ${styles.portalLoadingAvatar}`}
                />
                <span className={styles.portalLoadingIdentityText}>
                  <span
                    className={`${styles.portalSkeleton} ${styles.portalLoadingIdentityName}`}
                  />
                  <span
                    className={`${styles.portalSkeleton} ${styles.portalLoadingIdentityMeta}`}
                  />
                </span>
              </div>
              <span
                className={`${styles.portalSkeleton} ${styles.portalLoadingRowStatus}`}
              />
              <span className={styles.portalLoadingMetric}>
                <span
                  className={`${styles.portalSkeleton} ${styles.portalLoadingMetricValue}`}
                />
                <span
                  className={`${styles.portalSkeleton} ${styles.portalLoadingMetricLabel}`}
                />
              </span>
              <span
                className={`${styles.portalSkeleton} ${styles.portalLoadingChevron}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
