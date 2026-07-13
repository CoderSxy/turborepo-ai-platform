"use client";

import type { ReactNode } from "react";
import styles from "./shell.module.css";
import { APP_NAV_ITEMS, type AppPage } from "./shell-types";

export function AppShell({
  activePage,
  onNavigate,
  children,
}: {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}) {
  return (
    <main className={styles.appFrame}>
      <aside className={styles.appSidebar}>
        <button
          className={styles.appBrand}
          onClick={() => onNavigate("home")}
        >
          <span>S</span>
          <strong>SXY Platform</strong>
          <em>Creative AI Studio</em>
        </button>

        <nav className={styles.appNav}>
          {APP_NAV_ITEMS.map((item) => (
            <button
              key={item.page}
              className={activePage === item.page ? styles.appNavActive : ""}
              onClick={() => onNavigate(item.page)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
      </aside>
      <section className={styles.appContent}>{children}</section>
    </main>
  );
}
