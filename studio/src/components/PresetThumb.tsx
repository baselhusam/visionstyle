import { useId } from 'react';
import { BOX, RAMP, VIEW, thumbFor, type Paint } from '../thumbnail';
import type { Style } from '../types/style';
import { usePalettes } from './PaletteInput';

/** A saved preset drawn from its own style, in the same tile as the built-in glyphs. */
export function PresetThumb({ style }: { style: Style }) {
  const palettes = usePalettes();
  const t = thumbFor(style, palettes);
  const id = useId().replace(/:/g, '');
  const ref = (name: string) => `url(#${id}-${name})`;
  const color = (p: Paint) => (p === 'ramp' ? ref('ramp') : p);
  const solid = (p: Paint) => (p === 'ramp' ? RAMP[2] : p);
  const { x, y, w, h } = BOX;

  const outline = (() => {
    if (t.shape === 'none') return null;
    if (t.shape === 'corners') {
      const l = t.cornerLength;
      return `M${x} ${y + l}V${y}H${x + l}M${x + w - l} ${y}H${x + w}V${y + l}M${x + w} ${y + h - l}V${y + h}H${x + w - l}M${x + l} ${y + h}H${x}V${y + h - l}`;
    }
    if (t.shape === 'reticle') {
      const l = t.reticleLength;
      const mx = x + w / 2, my = y + h / 2;
      return `M${mx} ${y}V${y + l}M${mx} ${y + h}V${y + h - l}M${x} ${my}H${x + l}M${x + w} ${my}H${x + w - l}`;
    }
    const r = t.radius;
    return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
  })();

  // multi-color segments: one dashed copy of the outline per color, offset so the colors take turns
  const strokes = (() => {
    const s = t.stroke;
    if (!s || !outline) return null;
    const common = { fill: 'none', strokeWidth: s.width, strokeOpacity: s.opacity, strokeLinecap: s.round ? 'round' as const : 'butt' as const, strokeLinejoin: 'round' as const };
    if (s.segments?.length) {
      const n = s.segments.length;
      const [dash, gap] = s.dash ? s.dash.split(' ').map(Number) : [(2 * (w + h)) / (n * 2), 0];
      const unit = dash + gap;
      return s.segments.map((c, i) => (
        <path key={i} d={outline} stroke={c} strokeDasharray={`${dash} ${unit * n - dash}`} strokeDashoffset={-i * unit} {...common} />
      ));
    }
    return <path d={outline} stroke={s.gradient?.length ? ref('segments') : color(s.paint)} strokeDasharray={s.dash} {...common} />;
  })();

  const fillGradient = t.fill?.mode === 'gradient' ? (() => {
    const d = t.fill.direction;
    const [x1, y1, x2, y2] = d === 'up' ? [0, 1, 0, 0] : d === 'left' ? [1, 0, 0, 0] : d === 'right' ? [0, 0, 1, 0] : [0, 0, 0, 1];
    const stops = [<stop key="a" offset="0" stopColor={solid(t.fill.paint)} stopOpacity={t.fill.start * t.fill.opacity} />, <stop key="b" offset="1" stopColor={solid(t.fill.paint)} stopOpacity={t.fill.end * t.fill.opacity} />];
    return d === 'radial'
      ? <radialGradient id={`${id}-fill`}>{stops}</radialGradient>
      : <linearGradient id={`${id}-fill`} x1={x1} y1={y1} x2={x2} y2={y2}>{stops}</linearGradient>;
  })() : null;

  const chip = t.chip;
  const trailPaint = t.trail ? solid(t.trail.paint) : '';
  return (
    <svg className="thumb" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ramp`} x1="0" y1="0" x2="1" y2="0">
          {RAMP.map((c, i) => <stop key={c} offset={i / (RAMP.length - 1)} stopColor={c} />)}
        </linearGradient>
        {t.stroke?.gradient?.length ? (
          <linearGradient id={`${id}-segments`} x1="0" y1="0" x2="1" y2="1">
            {t.stroke.gradient.map((c, i, all) => <stop key={i} offset={i / Math.max(1, all.length - 1)} stopColor={c} />)}
          </linearGradient>
        ) : null}
        {fillGradient}
        {t.fill?.mode === 'hatch' && (
          <pattern id={`${id}-hatch`} width={t.fill.hatchSpacing} height={t.fill.hatchSpacing} patternUnits="userSpaceOnUse" patternTransform={`rotate(${t.fill.hatchAngle})`}>
            <line x1="0" y1="0" x2="0" y2={t.fill.hatchSpacing} stroke={solid(t.fill.paint)} strokeWidth="0.8" strokeOpacity={Math.min(1, t.fill.opacity * 3)} />
          </pattern>
        )}
        {t.trail && (
          <linearGradient id={`${id}-trail`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor={trailPaint} stopOpacity="0.9" />
            <stop offset="1" stopColor={trailPaint} stopOpacity="0" />
          </linearGradient>
        )}
        <filter id={`${id}-fx`} x="-50%" y="-50%" width="200%" height="200%">
          {t.shadow && <feDropShadow dx={t.shadow.dx} dy={t.shadow.dy} stdDeviation={t.shadow.blur} floodColor="#000" floodOpacity={t.shadow.opacity} />}
          {t.glow && <feDropShadow dx="0" dy="0" stdDeviation={t.glow.blur} floodColor={solid(t.glow.paint)} floodOpacity={Math.min(1, t.glow.strength)} />}
          {t.glow && t.glow.strength > 1 && <feDropShadow dx="0" dy="0" stdDeviation={t.glow.blur * 1.6} floodColor={solid(t.glow.paint)} floodOpacity={t.glow.strength - 1} />}
        </filter>
      </defs>

      {t.dim > 0 && (
        <path d={`M0 0H${VIEW.w}V${VIEW.h}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z`} fillRule="evenodd" fill="#000" fillOpacity={t.dim * 0.75} />
      )}
      {t.trail && (
        <path
          d={`M${x + w / 2} ${y + h}C${x + w / 2 - 8} ${y + h + 7} ${x - 18} ${y + h + 1} ${x - 40} ${y + h + 9}`}
          fill="none"
          stroke={`url(#${id}-trail)`}
          strokeWidth={t.trail.width}
          strokeLinecap="round"
          strokeDasharray={t.trail.kind === 'dotted' ? `0 ${t.trail.width + 2.5}` : t.trail.kind === 'dashed' ? '4 3' : undefined}
        />
      )}
      {t.glass > 0 && (
        <rect x={x} y={y} width={w} height={h} rx={t.shape === 'rounded' ? t.radius : 0} fill="#ffffff" fillOpacity={t.glass} />
      )}
      {t.fill && (
        <rect x={x} y={y} width={w} height={h} rx={t.shape === 'rounded' ? t.radius : 0}
          fill={t.fill.mode === 'gradient' ? ref('fill') : t.fill.mode === 'hatch' ? ref('hatch') : color(t.fill.paint)}
          fillOpacity={t.fill.mode === 'solid' ? t.fill.opacity : 1} />
      )}
      <g filter={t.glow || t.shadow ? ref('fx') : undefined}>
        {t.shape === 'reticle' && t.stroke && (
          <rect x={x} y={y} width={w} height={h} fill="none" stroke={color(t.stroke.paint)} strokeWidth={Math.max(0.5, t.stroke.width * 0.6)} strokeOpacity={t.stroke.opacity * 0.35} />
        )}
        {strokes}
        {t.double && t.stroke && (
          <rect x={x + t.double.gap} y={y + t.double.gap} width={w - t.double.gap * 2} height={h - t.double.gap * 2}
            rx={t.shape === 'rounded' ? Math.max(0, t.radius - t.double.gap) : 0}
            fill="none" stroke={color(t.stroke.paint)} strokeWidth={Math.max(0.5, t.stroke.width * 0.6)} strokeOpacity={t.double.opacity} />
        )}
        {t.centerMark && t.stroke && (
          <path d={`M${x + w / 2 - 3} ${y + h / 2}h6M${x + w / 2} ${y + h / 2 - 3}v6`} stroke={color(t.stroke.paint)} strokeWidth={Math.max(0.6, t.stroke.width * 0.5)} />
        )}
      </g>
      {chip && (
        <g>
          {(chip.background === 'solid' || chip.background === 'pill' || chip.background === 'glass') && (
            <rect x={chip.x} y={chip.y} width={chip.w} height={chip.h} rx={chip.radius}
              fill={color(chip.fill)} fillOpacity={chip.opacity}
              stroke={chip.background === 'glass' ? '#ffffff' : undefined} strokeOpacity={0.55} strokeWidth={0.4} />
          )}
          {chip.background === 'underline' && (
            <line x1={chip.x} y1={chip.y + chip.h + 0.4} x2={chip.x + chip.w} y2={chip.y + chip.h + 0.4} stroke={color(chip.fill)} strokeWidth="0.9" />
          )}
          <text
            x={chip.x + chip.w / 2}
            y={chip.y + chip.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={chip.size}
            fontWeight={600}
            fontFamily={chip.mono ? 'var(--mono)' : 'var(--sans)'}
            fill={color(chip.textColor)}
          >
            {chip.text}
          </text>
        </g>
      )}
    </svg>
  );
}
