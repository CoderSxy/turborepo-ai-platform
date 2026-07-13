"use client";

import { useState } from "react";
import styles from "../studio.module.css";
import type { ModelPickerGroup } from "../state/studio-types";
import { ModelPicker } from "./chat/ModelPicker";

export function CreateBookPanel({
  modelGroups,
  selectedModelValue,
  hasBooks,
  errorMessage,
  onCancel,
  onCreate,
  onManageModels,
  onModelChange,
}: {
  modelGroups: ModelPickerGroup[];
  selectedModelValue: string;
  hasBooks: boolean;
  errorMessage?: string;
  onCancel: () => void;
  onCreate: (input: {
    title: string;
    genre: string;
    premise: string;
  }) => void | Promise<void>;
  onManageModels: () => void;
  onModelChange: (value: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [premise, setPremise] = useState("");
  const canCreate = title.trim().length > 0;

  return (
    <section className={styles.createBookScreen}>
      <div className={styles.createBookBox}>
        <span>SXY InkOS</span>
        <h2>{hasBooks ? "新建书籍" : "创建第一本书籍"}</h2>
        <p>
          先建立一本书，随后进入 AI 创作工作台；一本书可以拥有多个会话。
        </p>
        {errorMessage ? (
          <div className={styles.createBookError}>{errorMessage}</div>
        ) : null}
        <label>
          书名
          <input
            value={title}
            placeholder='例如：裂缝中的阳光'
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          题材
          <input
            value={genre}
            placeholder='例如：都市悬疑 / 现实异能'
            onChange={(event) => setGenre(event.target.value)}
          />
        </label>
        <label>
          核心设定
          <textarea
            rows={4}
            value={premise}
            placeholder='一句话描述主角、冲突或世界观。'
            onChange={(event) => setPremise(event.target.value)}
          />
        </label>
        <div className={styles.createBookModelRow}>
          <span>模型</span>
          <ModelPicker
            value={selectedModelValue}
            groups={modelGroups}
            recentModels={[]}
            onManageModels={onManageModels}
            onValueChange={onModelChange}
          />
        </div>
        <div className={styles.createBookActions}>
          {hasBooks ? (
            <button onClick={onCancel}>取消</button>
          ) : null}
          <button
            className={styles.primaryButton}
            disabled={!canCreate}
            onClick={() => {
              void onCreate({
                title,
                genre,
                premise,
              });
            }}
          >
            创建书籍
          </button>
        </div>
      </div>
    </section>
  );
}
