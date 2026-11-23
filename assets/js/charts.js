// กราฟ (Chart.js) — สีอ่านจาก CSS tokens เพื่อรองรับโหมดสว่าง/มืด
import { num } from './ui.js';

const registry = new Map();
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function base() {
  const C = window.Chart;
  C.defaults.font.family = "'Anuphan', system-ui, sans-serif";
  C.defaults.font.size = 12;
  C.defaults.color = css('--muted');
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink-2'),
        borderColor: css('--line-strong'), borderWidth: 1, padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${num(c.parsed.y ?? c.parsed.x)} บาท` },
      },
    },
  };
}

function mount(id, config) {
  const el = document.getElementById(id);
  if (!el || !window.Chart) return;
  registry.get(id)?.destroy();
  registry.set(id, new window.Chart(el, config));
}
export function destroyAll() { registry.forEach((c) => c.destroy()); registry.clear(); }

const grid = () => ({ color: css('--grid'), drawTicks: false });
const axisY = (fmt) => ({ grid: grid(), border: { display: false }, ticks: { padding: 8, callback: fmt } });
const axisX = () => ({ grid: { display: false }, border: { color: css('--baseline') }, ticks: { padding: 6 } });
const kfmt = (v) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : v);

// แท่งซ้อน: งบประมาณรายปี แยกภายนอก/ภายใน (2 series)
export function yearlyStacked(id, rows) {
  const surface = css('--surface');
  mount(id, {
    type: 'bar',
    data: {
      labels: rows.map((r) => `ปี ${r.year}`),
      datasets: [
        { label: 'หน่วยงานภายนอก', data: rows.map((r) => r.external), backgroundColor: css('--s1'), borderRadius: 4, borderSkipped: 'start', borderColor: surface, borderWidth: { top: 2 }, maxBarThickness: 44 },
        { label: 'ภายในสถานศึกษา', data: rows.map((r) => r.internal), backgroundColor: css('--s2'), borderRadius: 4, borderSkipped: 'start', borderColor: surface, borderWidth: { top: 2 }, maxBarThickness: 44 },
      ],
    },
    options: { ...base(), scales: { x: { ...axisX(), stacked: true }, y: { ...axisY(kfmt), stacked: true } } },
  });
}

// แท่งแนวนอน single series: จัดอันดับ
export function rankBars(id, rows, { label = 'ยอดทุน', color = '--s1' } = {}) {
  const b = base();
  mount(id, {
    type: 'bar',
    data: { labels: rows.map((r) => r.name.replace(/^แผนกวิชา/, '')), datasets: [{ label, data: rows.map((r) => r.amount), backgroundColor: css(color), borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18, counts: rows.map((r) => r.count) }] },
    options: {
      ...b, indexAxis: 'y', interaction: { mode: 'nearest', axis: 'y', intersect: false },
      plugins: { ...b.plugins, tooltip: { ...b.plugins.tooltip, callbacks: { label: (c) => ` ${num(c.parsed.x)} บาท · ${c.dataset.counts[c.dataIndex]} ทุน` } } },
      scales: { x: { ...axisY(kfmt), position: 'top' }, y: { grid: { display: false }, border: { color: css('--baseline') }, ticks: { color: css('--ink-2'), autoSkip: false } } },
    },
  });
}
