import type { SVGProps } from "react";

export type IconName =
  | "alert"
  | "archive"
  | "arrow"
  | "building"
  | "calendar"
  | "chart"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "copy"
  | "download"
  | "expand"
  | "external"
  | "filter"
  | "flag"
  | "gamepad"
  | "grid"
  | "history"
  | "home"
  | "lock"
  | "logout"
  | "menu"
  | "module"
  | "more"
  | "pause"
  | "play"
  | "plus"
  | "search"
  | "settings"
  | "shrink"
  | "shield"
  | "school"
  | "upload"
  | "users";

type IconProps = SVGProps<SVGSVGElement> & { name: IconName };

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {name === "home" && (
        <>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </>
      )}
      {name === "flag" && <path d="M5 21V4m0 1h11l-2.5 4L16 13H5" />}
      {name === "expand" && <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />}
      {name === "shrink" && <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5" />}
      {name === "chart" && <path d="M4 20V10m6 10V4m6 16v-7m5 7H2" />}
      {name === "grid" && (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </>
      )}
      {name === "users" && (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87m-2-12a4 4 0 0 1 0 7.75" />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "building" && (
        <path d="M3 21h18M6 21V7l6-4 6 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3" />
      )}
      {name === "school" && (
        <>
          <path d="m3 10 9-5 9 5-9 5-9-5Z" />
          <path d="M7 13v5c3 2 7 2 10 0v-5M21 10v6" />
        </>
      )}
      {name === "chevron" && <path d="m9 18 6-6-6-6" />}
      {name === "more" && (
        <>
          <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
        </>
      )}
      {name === "arrow" && <path d="M5 12h14m-6-6 6 6-6 6" />}
      {name === "check" && <path d="m5 12 4 4L19 6" />}
      {name === "copy" && (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
        </>
      )}
      {name === "download" && <path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />}
      {name === "shield" && (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      )}
      {name === "play" && <path d="m8 5 11 7-11 7Z" />}
      {name === "clock" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {name === "search" && (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </>
      )}
      {name === "filter" && <path d="M4 5h16M7 12h10m-7 7h4" />}
      {name === "pause" && (
        <>
          <path d="M9 5v14M15 5v14" />
        </>
      )}
      {name === "archive" && (
        <>
          <rect x="3" y="4" width="18" height="5" rx="1" />
          <path d="M5 9v11h14V9m-9 4h4" />
        </>
      )}
      {name === "upload" && (
        <>
          <path d="M12 16V3m-5 5 5-5 5 5" />
          <path d="M4 15v5h16v-5" />
        </>
      )}
      {name === "settings" && (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.07 14H3v-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.02A1.7 1.7 0 0 0 10 3.07V3h4v.09A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.02A1.7 1.7 0 0 0 20.93 10H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
        </>
      )}
      {name === "lock" && (
        <>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
      {name === "logout" && <path d="M10 17l5-5-5-5m5 5H3m12-9h5v18h-5" />}
      {name === "alert" && (
        <>
          <path d="M10.3 3.7 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4m0 4h.01" />
        </>
      )}
      {name === "calendar" && (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 10h18" />
        </>
      )}
      {name === "external" && <path d="M14 3h7v7m0-7-9 9M19 13v7H4V5h7" />}
      {name === "menu" && <path d="M4 6h16M4 12h16M4 18h16" />}
      {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
      {name === "gamepad" && (
        <>
          <path d="M8 6h8a6 6 0 0 1 5.7 7.9l-1 3a2.5 2.5 0 0 1-4.3.8L14.8 16H9.2l-1.6 1.7a2.5 2.5 0 0 1-4.3-.8l-1-3A6 6 0 0 1 8 6Z" />
          <path d="M7 10v4m-2-2h4m7-1h.01m2 2h.01" />
        </>
      )}
      {name === "module" && (
        <>
          <path d="m12 2 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
        </>
      )}
      {name === "history" && (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5m4-2v6l4 2" />
        </>
      )}
    </svg>
  );
}
