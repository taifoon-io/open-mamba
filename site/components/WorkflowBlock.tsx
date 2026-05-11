/**
 * n8n-style workflow visual — 5 nodes connected by arrows showing the
 * open-mamba dispatch path. Pure SVG, no images.
 */
export function WorkflowBlock() {
  const NODES = [
    { x: 20,  y: 60, label: "POST",     sub: "/ingest"     },
    { x: 175, y: 60, label: "QUEUE",    sub: "DuckDB lake" },
    { x: 330, y: 60, label: "WORKER",   sub: "max 4 hot"   },
    { x: 485, y: 60, label: "DISPATCH", sub: "claude · nemotron" },
    { x: 640, y: 60, label: "RECEIPT",  sub: "tokens · cost" },
  ];
  const NODE_W = 130;
  const NODE_H = 60;

  return (
    <svg viewBox="0 0 800 200" className="w-full" role="img" aria-label="open-mamba workflow">
      <title>open-mamba workflow</title>
      <desc>Five connected nodes: POST → QUEUE → WORKER → DISPATCH → RECEIPT</desc>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="rgb(52,211,153)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </marker>
      </defs>

      {/* Connectors */}
      {NODES.slice(0, -1).map((n, i) => {
        const next = NODES[i + 1];
        const x1 = n.x + NODE_W;
        const x2 = next.x;
        const y  = n.y + NODE_H / 2;
        return (
          <line
            key={i}
            x1={x1}
            y1={y}
            x2={x2 - 4}
            y2={y}
            stroke="rgb(52,211,153)"
            strokeWidth="1"
            strokeDasharray="3 4"
            markerEnd="url(#arr)"
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((n) => (
        <g key={n.label}>
          <rect
            x={n.x}
            y={n.y}
            width={NODE_W}
            height={NODE_H}
            fill="rgb(16,19,16)"
            stroke="rgba(52,211,153,0.4)"
            strokeWidth="1"
          />
          {/* Mint accent corner */}
          <rect
            x={n.x}
            y={n.y}
            width={NODE_W}
            height="2"
            fill="rgb(52,211,153)"
          />
          <text
            x={n.x + NODE_W / 2}
            y={n.y + 28}
            textAnchor="middle"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            fontSize="13"
            fontWeight="600"
            fill="rgb(230,240,247)"
            letterSpacing="2"
          >
            {n.label}
          </text>
          <text
            x={n.x + NODE_W / 2}
            y={n.y + 46}
            textAnchor="middle"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            fontSize="10"
            fill="rgba(230,240,247,0.5)"
            letterSpacing="1.5"
          >
            {n.sub}
          </text>
        </g>
      ))}

      {/* Trigger callouts above */}
      <text x="85"  y="40" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="rgba(52,211,153,0.7)" letterSpacing="2">webhook · cron · cli</text>
      {/* Output callout below */}
      <text x="705" y="148" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="rgba(52,211,153,0.7)" letterSpacing="2">→ slack · email · github</text>
    </svg>
  );
}
