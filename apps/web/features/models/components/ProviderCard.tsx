"use client";

import type { LocalModelProvider } from "../../../lib/model-settings";
import { isProviderConnected } from "../state/model-page-types";
import styles from "../models.module.css";
import { StatusPill } from "./StatusPill";

export function ProviderCard({
  provider,
  onOpen,
}: {
  provider: LocalModelProvider;
  onOpen: () => void;
}) {
  return (
    <button className={styles.providerCard} onClick={onOpen}>
      <span>
        <strong>{provider.name}</strong>
        <em>{provider.baseUrl}</em>
      </span>
      <StatusPill
        status={isProviderConnected(provider) ? "ready" : "missing-api-key"}
      />
    </button>
  );
}
