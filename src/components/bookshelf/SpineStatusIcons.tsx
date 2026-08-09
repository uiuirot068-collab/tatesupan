import styles from "./Bookshelf.module.css";

export type SpineStatusIconKind = "cloud" | "warning" | "shosin" | "key";

export interface SpineStatusIcon {
  kind: SpineStatusIconKind;
  label: string;
}

interface SpineStatusIconsProps {
  statuses?: SpineStatusIcon[];
}

export function SpineStatusIcons({ statuses = [] }: SpineStatusIconsProps) {
  const visibleStatuses = statuses.slice(0, 2);
  if (visibleStatuses.length === 0) return null;

  const accessibleName = visibleStatuses.map(({ label }) => label).join("、");

  return (
    <span
      className={styles.spineStatusIcons}
      role="img"
      aria-label={accessibleName}
      title={accessibleName}
    >
      {visibleStatuses.map(({ kind, label }) =>
        kind === "cloud" ? (
          <span
            key={`${kind}-${label}`}
            className={`${styles.spineStatusIcon} ${styles.cloudStatusIcon}`}
            aria-hidden="true"
          />
        ) : kind === "shosin" ? (
          <svg
            key={`${kind}-${label}`}
            className={`${styles.spineStatusIcon} ${styles.shosinStatusIcon}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <polygon
              className={styles.shosinYellow}
              points="11.999,21.604 11.999,7.293 4.328,2.395 4.328,17.092"
            />
            <polygon
              className={styles.shosinGreen}
              points="11.999,21.604 11.999,7.293 19.67,2.395 19.67,17.092"
            />
          </svg>
        ) : kind === "warning" ? (
          <svg
            key={`${kind}-${label}`}
            className={`${styles.spineStatusIcon} ${styles.warningStatusIcon}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <polygon
              className={styles.warningTriangle}
              points="12.053,3.429 2.312,20.703 21.749,20.703"
            />
            <polygon
              className={styles.warningMark}
              points="10.576,6.716 10.981,15.625 12.993,15.625 13.398,6.716"
            />
            <rect
              className={styles.warningMark}
              x="10.981"
              y="17.778"
              width="1.996"
              height="1.996"
            />
          </svg>
        ) : (
          <svg
            key={`${kind}-${label}`}
            className={`${styles.spineStatusIcon} ${styles.keyStatusIcon}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              className={styles.keyShackle}
              d="M11.97 18.195a7.024 7.024 0 0 1-7.016-7.016v-.294a7.024 7.024 0 0 1 7.016-7.016 7.024 7.024 0 0 1 7.016 7.016v.294a7.024 7.024 0 0 1-7.016 7.016Zm0-12.659a5.356 5.356 0 0 0-5.35 5.35v.294a5.356 5.356 0 0 0 5.35 5.35 5.356 5.356 0 0 0 5.35-5.35v-.294a5.356 5.356 0 0 0-5.35-5.35Z"
            />
            <path
              className={styles.keyBody}
              d="M19.92 10.087H4.019a1 1 0 0 0-1 1v8.985a1 1 0 0 0 1 1H19.92a1 1 0 0 0 1-1v-8.985a1 1 0 0 0-1-1Z"
            />
            <path
              className={styles.keyHole}
              d="M14.266 13.182a2.297 2.297 0 1 0-3.155 2.128v4.157a.858.858 0 1 0 1.715 0v-4.158a2.297 2.297 0 0 0 1.44-2.127Z"
            />
            <circle
              className={styles.keyCenter}
              cx="11.97"
              cy="13.398"
              r="1.18"
            />
          </svg>
        ),
      )}
    </span>
  );
}
