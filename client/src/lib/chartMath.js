// Wilson score interval for a binomial proportion - the standard method
// for a compliance-rate confidence interval, and notably more reliable than
// the naive normal approximation when n is small or the rate is near 0/100,
// which is exactly the regime a lot of this data falls into.
export function wilsonInterval(compliant, total, z = 1.96) {
  if (!total || total <= 0) return null;
  const p = compliant / total;
  const n = total;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    low: Math.max(0, Math.round((center - margin) * 1000) / 10),
    high: Math.min(100, Math.round((center + margin) * 1000) / 10),
  };
}

// Clean, round-number tick marks for a 0-100 percent axis, rather than
// letting the chart library auto-generate irregular values like 76/61/46.
export function niceTicks(lo, hi) {
  const range = hi - lo;
  let step;
  if (range <= 20) step = 5;
  else if (range <= 40) step = 10;
  else if (range <= 60) step = 20;
  else step = 25;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let t = start; t <= end; t += step) ticks.push(t);
  return { ticks, domain: [start, end] };
}
