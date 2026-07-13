"use client";

import { useMemo, useState } from "react";
import { formatModelPickerValue } from "../../../../lib/model-settings";
import styles from "../../studio.module.css";
import type { ModelPickerGroup } from "../../state/studio-types";

export function ModelPicker({
  value,
  groups,
  recentModels,
  onManageModels,
  onValueChange,
}: {
  value: string;
  groups: ModelPickerGroup[];
  recentModels: Array<{ providerId: string; model: string }>;
  onManageModels: () => void;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query) ||
            group.label.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [groups, search]);
  const selected = useMemo(() => {
    const [service, modelId] = value.split("::");
    const group = groups.find((item) => item.service === service);
    const model = group?.models.find((item) => item.id === modelId);

    return group && model
      ? { group, model, label: `${group.label} · ${model.name}` }
      : null;
  }, [groups, value]);
  const recentOptions = useMemo(() => {
    return recentModels
      .map((item) => {
        const itemValue = formatModelPickerValue(item.providerId, item.model);
        const group = groups.find((entry) => entry.service === item.providerId);
        const model = group?.models.find((entry) => entry.id === item.model);

        if (!group || !model) {
          return null;
        }

        return {
          value: itemValue,
          label: `${group.label} · ${model.name}`,
        };
      })
      .filter((item): item is { value: string; label: string } => item !== null);
  }, [groups, recentModels]);

  if (groups.length === 0) {
    return (
      <button className={styles.modelPickerEmpty} onClick={onManageModels}>
        配置模型 →
      </button>
    );
  }

  return (
    <div className={styles.modelPickerRoot}>
      <button
        className={styles.modelPickerTrigger}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label ?? "选择模型"}</span>
        <em>⌄</em>
      </button>

      {open ? (
        <div className={styles.modelPickerMenu}>
          <input
            value={search}
            placeholder='搜索模型...'
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className={styles.modelPickerList}>
            {recentOptions.length > 0 ? (
              <section>
                <strong>最近使用</strong>
                {recentOptions.map((item) => {
                  const selectedItem = item.value === value;

                  return (
                    <button
                      key={`recent-${item.value}`}
                      className={selectedItem ? styles.activeModelItem : ""}
                      onClick={() => {
                        onValueChange(item.value);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span>{item.label}</span>
                      {selectedItem ? <em>✓</em> : null}
                    </button>
                  );
                })}
              </section>
            ) : null}
            {filteredGroups.map((group) => (
              <section key={group.service}>
                <strong>{group.label}</strong>
                {group.models.map((model) => {
                  const itemValue = `${group.service}::${model.id}`;
                  const selectedItem = itemValue === value;

                  return (
                    <button
                      key={itemValue}
                      className={selectedItem ? styles.activeModelItem : ""}
                      onClick={() => {
                        onValueChange(itemValue);
                        setOpen(false);
                        setSearch("");
                      }}
                    >
                      <span>{model.name}</span>
                      {selectedItem ? <em>✓</em> : null}
                    </button>
                  );
                })}
              </section>
            ))}
            {filteredGroups.length === 0 ? (
              <p className={styles.emptyModelSearch}>无匹配模型</p>
            ) : null}
          </div>
          <button className={styles.modelManageButton} onClick={onManageModels}>
            管理服务商
          </button>
        </div>
      ) : null}
    </div>
  );
}
