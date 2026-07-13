"use client";

import { useMemo } from "react";
import {
  NOVEL_CHARACTER_RELATION_KIND_LABELS,
  buildNovelCharacterRelationGraph,
} from "../../../../lib/novel-store";
import styles from "../../studio.module.css";

export function CharacterRelationGraphPanel({
  graph,
}: {
  graph: ReturnType<typeof buildNovelCharacterRelationGraph>;
}) {
  const layout = useMemo(() => {
    const width = 560;
    const height = 360;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(90, Math.min(150, graph.nodes.length * 16));
    const nodePositions = new Map<string, { x: number; y: number }>();

    graph.nodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(graph.nodes.length, 1) - Math.PI / 2;
      nodePositions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return {
      width,
      height,
      nodePositions,
    };
  }, [graph.nodes]);

  if (graph.nodes.length === 0) {
    return (
      <p className={styles.emptyMiniState}>
        暂无可视化角色。请先添加角色资产或在大纲节点中标注出场角色。
      </p>
    );
  }

  return (
    <div className={styles.characterRelationPanel}>
      <svg
        className={styles.characterRelationGraph}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role='img'
        aria-label='角色关系图'
      >
        {graph.edges.map((edge) => {
          const source = layout.nodePositions.get(edge.sourceId);
          const target = layout.nodePositions.get(edge.targetId);

          if (!source || !target) {
            return null;
          }

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          return (
            <g key={edge.id}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={styles.characterRelationEdge}
                data-kind={edge.kind}
              />
              <text
                x={midX}
                y={midY}
                className={styles.characterRelationEdgeLabel}
              >
                {edge.label}
              </text>
            </g>
          );
        })}
        {graph.nodes.map((node) => {
          const position = layout.nodePositions.get(node.id);

          if (!position) {
            return null;
          }

          return (
            <g key={node.id} className={styles.characterRelationNode}>
              <circle cx={position.x} cy={position.y} r={18} />
              <text x={position.x} y={position.y + 34} textAnchor='middle'>
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>

      {graph.edges.length > 0 ? (
        <div className={styles.characterRelationLegend}>
          {(
            Object.keys(NOVEL_CHARACTER_RELATION_KIND_LABELS) as Array<
              keyof typeof NOVEL_CHARACTER_RELATION_KIND_LABELS
            >
          ).map((kind) => (
            <span key={kind} data-kind={kind}>
              {NOVEL_CHARACTER_RELATION_KIND_LABELS[kind]}
            </span>
          ))}
        </div>
      ) : null}

      <div className={styles.characterRelationList}>
        {graph.edges.length === 0 ? (
          <p className={styles.emptyMiniState}>
            尚未推断关系。可在角色卡中写明「与 XX 是盟友/对手」等描述。
          </p>
        ) : (
          graph.edges.map((edge) => {
            const source = graph.nodes.find((node) => node.id === edge.sourceId);
            const target = graph.nodes.find((node) => node.id === edge.targetId);

            return (
              <article key={edge.id} className={styles.characterRelationItem}>
                <strong>
                  {source?.label} ↔ {target?.label}
                </strong>
                <span>
                  {NOVEL_CHARACTER_RELATION_KIND_LABELS[edge.kind]} · {edge.label}
                </span>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
