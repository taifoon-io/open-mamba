/**
 * Refined architecture diagram. Editorial proportions, generous whitespace,
 * a small legend underneath, and primary/secondary line treatment. Static
 * SVG, no client JS, accessible labels.
 *
 * Token-aligned colours kept inline because SVG attributes can't read
 * Tailwind utilities. If the palette shifts, update here.
 */

const C = {
  ink:      '#1A2421',
  inkSoft:  '#36433E',
  inkMuted: '#6E7570',
  paper:    '#F5F1E8',
  paperAlt: '#EFE9DC',
  line:     '#CDD0C8',
  accent:   '#2A6E5E', // mamba green
  bronze:   '#A66E38', // bronze
  ember:    '#C96442', // ember (used once, on Triton — destination of compute)
};

export function ArchitectureDiagram() {
  return (
    <figure className="not-prose my-10">
      <svg
        viewBox="0 0 960 420"
        className="w-full h-auto"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Request flow architecture</title>
        <desc id="arch-desc">
          A certified agent calls Solo.io Agentgateway, which routes to the
          mamba-nemotron-agw-adapter, which proxies to NVIDIA Triton. The
          adapter emits audit events, lineage events, and OpenTelemetry
          traces to dedicated sidecar paths.
        </desc>

        <defs>
          {/* Solid arrowhead for primary path */}
          <marker id="arrow-solid" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={C.bronze} />
          </marker>
          {/* Dashed arrowhead for emit path */}
          <marker id="arrow-dashed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={C.inkMuted} />
          </marker>
        </defs>

        {/* Lane labels */}
        <Lane y={26}  label="REQUEST PATH" />
        <Lane y={272} label="EMIT PATH (asynchronous)" />

        {/* === Top lane — primary path === */}
        <Box x={40}  y={56}  w={210} h={96}
          eyebrow="Caller" title="Certified agent" sub="Anthropic SDK · LangChain · custom" />
        <Arrow x1={250} y1={104} x2={365} y2={104} label="OpenAI-compat" primary />

        <Box x={365} y={56}  w={210} h={96}
          eyebrow="Edge" title="Solo.io Agentgateway" sub="Capability · budget · token cost" />
        <Arrow x1={575} y1={104} x2={690} y2={104} label="upstream · mTLS" primary />

        <Box x={690} y={40}  w={230} h={128} accent
          eyebrow="This component" title="mamba-nemotron-agw-adapter"
          sub="OpenAI-compat surface · pre/post guardrails" />

        {/* Down to Triton */}
        <Arrow x1={805} y1={168} x2={805} y2={232} vertical label="gRPC" primary />

        {/* === Triton (compute destination — single ember spark) === */}
        <Box x={690} y={232} w={230} h={96} ember
          eyebrow="Compute" title="NVIDIA Triton" sub="DGX / Spectrum-X · Nemotron 4 · 70B · Mini" />

        {/* === Bottom lane — emit path (sidecars) === */}
        <Box x={40}  y={300} w={210} h={92} subtle
          eyebrow="Audit" title="S3 Object Lock" sub="WORM · 5y retention · KMS-signed" />
        <Box x={290} y={300} w={210} h={92} subtle
          eyebrow="Lineage" title="OpenLineage · Marquez" sub="namespace: agentos.llm-calls" />
        <Box x={540} y={300} w={210} h={92} subtle
          eyebrow="Telemetry" title="OpenTelemetry collector" sub="Prometheus · Grafana · Loki" />

        {/* Adapter → emit paths (dashed) */}
        <Arrow x1={745} y1={168} x2={140} y2={300} dashed />
        <Arrow x1={760} y1={168} x2={395} y2={300} dashed />
        <Arrow x1={780} y1={168} x2={645} y2={300} dashed />
      </svg>

      <figcaption className="mt-4 grid gap-3 md:grid-cols-2 text-caption text-inkMuted">
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-px" style={{ backgroundColor: C.bronze }} />
          <span>Synchronous request path · adapter on the hot loop</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-6 h-px border-t border-dashed" style={{ borderColor: C.inkMuted }} />
          <span>Asynchronous emit path · audit, lineage, telemetry</span>
        </div>
      </figcaption>
    </figure>
  );
}

function Lane({ y, label }: { y: number; label: string }) {
  return (
    <text x={40} y={y} fill={C.inkMuted} fontFamily="JetBrains Mono, ui-monospace" fontSize="10" letterSpacing="0.12em">
      {label}
    </text>
  );
}

function Box({
  x, y, w, h, eyebrow, title, sub,
  accent = false, subtle = false, ember = false,
}: {
  x: number; y: number; w: number; h: number;
  eyebrow: string; title: string; sub: string;
  accent?: boolean; subtle?: boolean; ember?: boolean;
}) {
  const stroke = accent ? C.accent : ember ? C.ember : C.inkSoft;
  const strokeWidth = accent || ember ? 1.5 : 1;
  const fill = subtle ? C.paperAlt : '#FFFFFF';
  const eyebrowColour = accent ? C.accent : ember ? C.ember : C.inkMuted;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <text x={x + 16} y={y + 22} fill={eyebrowColour} fontFamily="JetBrains Mono, ui-monospace" fontSize="10" letterSpacing="0.12em">
        {eyebrow.toUpperCase()}
      </text>
      <text x={x + 16} y={y + 50} fill={C.ink} fontFamily="Inter, system-ui" fontSize="15" fontWeight="600">
        {title}
      </text>
      <text x={x + 16} y={y + 72} fill={C.inkSoft} fontFamily="Inter, system-ui" fontSize="12">
        {sub}
      </text>
    </g>
  );
}

function Arrow({
  x1, y1, x2, y2, label, vertical = false, dashed = false, primary = false,
}: {
  x1: number; y1: number; x2: number; y2: number;
  label?: string; vertical?: boolean; dashed?: boolean; primary?: boolean;
}) {
  const colour = primary ? C.bronze : C.inkMuted;
  const dash = dashed ? '4 4' : undefined;
  const marker = dashed ? 'url(#arrow-dashed)' : 'url(#arrow-solid)';
  return (
    <g>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={colour} strokeWidth={primary ? 1.5 : 1}
        strokeDasharray={dash}
        markerEnd={marker}
      />
      {label && (
        <text
          x={vertical ? x1 + 10 : (x1 + x2) / 2}
          y={vertical ? (y1 + y2) / 2 : y1 - 8}
          textAnchor={vertical ? 'start' : 'middle'}
          fill={colour}
          fontFamily="JetBrains Mono, ui-monospace"
          fontSize="11"
        >
          {label}
        </text>
      )}
    </g>
  );
}
