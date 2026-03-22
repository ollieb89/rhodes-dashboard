"use client";

import { useEffect, useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { apiFetch } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface DepEdge {
  from: string;
  to: string;
}

function nodeColor(status: string): string {
  const s = status.toLowerCase();
  if (s === "active" || s === "running") return "#16a34a";
  if (s === "paused") return "#d97706";
  if (s === "error") return "#dc2626";
  return "#52525b";
}

interface Props {
  agents: Agent[];
  onSelectAgent: (id: string) => void;
}

export function AgentGraph({ agents, onSelectAgent }: Props) {
  const [edges, setEdges] = useState<Edge[]>([]);

  const loadDeps = useCallback(() => {
    apiFetch("/api/agents/deps")
      .then((r) => r.json())
      .then((data) => {
        const raw: DepEdge[] = data.edges ?? [];
        setEdges(
          raw.map((e, i) => ({
            id: `e-${i}`,
            source: e.from,
            target: e.to,
            style: { stroke: "#52525b" },
          }))
        );
      })
      .catch(() => setEdges([]));
  }, []);

  useEffect(() => {
    loadDeps();
  }, [loadDeps]);

  const cols = Math.max(1, Math.ceil(Math.sqrt(agents.length)));
  const nodes: Node[] = agents.map((agent, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: agent.id,
      position: { x: col * 180, y: row * 100 },
      data: { label: agent.name || agent.id },
      style: {
        background: nodeColor(agent.status),
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "8px",
        fontSize: "12px",
        padding: "8px 12px",
        cursor: "pointer",
      },
    };
  });

  return (
    <div style={{ width: "100%", height: 400 }} className="rounded-xl overflow-hidden border border-zinc-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_event, node) => onSelectAgent(node.id)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#27272a" gap={16} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
