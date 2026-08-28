"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/shared/icon";

import styles from "./portal.module.css";

export function DemoActionButton({
  className,
  children,
  message,
}: {
  className?: string;
  children: ReactNode;
  message: string;
}) {
  const [notice, setNotice] = useState("");

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => {
          setNotice(message);
          window.setTimeout(() => setNotice(""), 3600);
        }}
      >
        {children}
      </button>
      {notice && (
        <div className={styles.toast} role="status">
          <Icon name="check" /> {notice}
        </div>
      )}
    </>
  );
}
