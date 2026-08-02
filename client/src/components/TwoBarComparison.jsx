import React from 'react';

// Mirrors the exact device used for YoY comparisons: a dim bar for the
// earlier period, a bright bar for the current one, and a dotted diagonal
// line connecting their tops with the delta labeled directly on it.
export default function TwoBarComparison({ startLabel, startValue, endLabel, endValue, unit = '%' }) {
  const W = 300;
  const H = 170;
  const baseline = 140;
  const barW = 64;
  const bar1X = 46;
  const bar2X = 190;
  const maxVal = 100;
  const bar1H = Math.max(2, (startValue / maxVal) * 100);
  const bar2H = Math.max(2, (endValue / maxVal) * 100);
  const bar1Top = baseline - bar1H;
  const bar2Top = baseline - bar2H;
  const delta = Math.round((endValue - startValue) * 10) / 10;
  const midX = (bar1X + barW / 2 + bar2X + barW / 2) / 2;
  const midY = (bar1Top + bar2Top) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${startLabel} ${startValue}${unit} to ${endLabel} ${endValue}${unit}`}>
      <line x1={0} y1={baseline} x2={W} y2={baseline} stroke="#333330" strokeWidth={1} />
      <rect x={bar1X} y={bar1Top} width={barW} height={bar1H} fill="#4a4a46" />
      <rect x={bar2X} y={bar2Top} width={barW} height={bar2H} fill="#f4f4f0" />
      <line
        x1={bar1X + barW / 2} y1={bar1Top - 4}
        x2={bar2X + barW / 2} y2={bar2Top - 4}
        stroke="#8f8f89" strokeWidth={1} strokeDasharray="3 3"
      />
      <text x={midX} y={midY - 10} textAnchor="middle" fill="#f4f4f0" fontSize={15} fontWeight={700}>
        {delta > 0 ? '+' : ''}{delta} pts
      </text>
      <text x={bar1X + barW / 2} y={bar1Top - 8} textAnchor="middle" fill="#c9c9c3" fontSize={12} fontWeight={600}>
        {Math.round(startValue)}{unit}
      </text>
      <text x={bar2X + barW / 2} y={bar2Top - 8} textAnchor="middle" fill="#f4f4f0" fontSize={13} fontWeight={700}>
        {Math.round(endValue)}{unit}
      </text>
      <text x={bar1X + barW / 2} y={baseline + 16} textAnchor="middle" fill="#8f8f89" fontSize={10}>
        {startLabel}
      </text>
      <text x={bar2X + barW / 2} y={baseline + 16} textAnchor="middle" fill="#8f8f89" fontSize={10}>
        {endLabel}
      </text>
    </svg>
  );
}
