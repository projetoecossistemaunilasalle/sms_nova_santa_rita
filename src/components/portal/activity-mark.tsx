import styles from "./portal.module.css";

const glyphs: Record<string, string> = {
  folha: "✦",
  gota: "◒",
  prato: "●",
  raio: "↗",
  brilho: "✣",
  coracao: "◆",
  link: "↗",
};

export function ActivityMark({
  symbol,
  tone,
}: {
  symbol: string;
  tone: string;
}) {
  return (
    <span
      className={`${styles.activityMark} ${styles[`tone${tone[0]?.toUpperCase()}${tone.slice(1)}`] ?? ""}`}
    >
      {glyphs[symbol] ?? "✦"}
    </span>
  );
}
