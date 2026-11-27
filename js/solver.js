/*
 * solver.js
 * Lógica del método gráfico para problemas de programación lineal con dos variables.
 *
 * Idea del algoritmo:
 *  1. Cada restricción a·x1 + b·x2 (<=, >=, =) r se convierte en uno o dos semiplanos  h·x <= k.
 *  2. Se intersectan todas las rectas frontera por pares (incluidos los ejes si x1, x2 >= 0).
 *  3. Los puntos de corte que cumplen todas las restricciones son los vértices de la región factible.
 *  4. Se evalúa Z en cada vértice. Se revisa si la región es no acotada en la dirección de mejora.
 */

const OPS = { '<=': '≤', '>=': '≥', '=': '=' };
const EPS = 1e-9;

/* ---------- Formato de números ---------- */

// Muestra el número como entero o fracción exacta (denominador hasta 60) cuando se puede.
function fmt(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) < EPS) v = 0;
  const r = Math.round(v);
  if (Math.abs(v - r) < EPS) return String(r).replace('-', '−');
  for (let d = 2; d <= 60; d++) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < EPS) return (n < 0 ? '−' : '') + Math.abs(n) + '/' + d;
  }
  return (+v.toFixed(3)).toString().replace('-', '−');
}

// Decimal con máximo dos cifras (para la gráfica).
function dec(v) {
  if (Math.abs(v) < EPS) v = 0;
  return (+v.toFixed(2)).toString().replace('-', '−');
}

// Fracción y su aproximación decimal, por ejemplo "8/3 ≈ 2.67".
function both(v) {
  const f = fmt(v);
  return f.includes('/') ? f + ' ≈ ' + dec(v) : f;
}

// Escribe a·x1 + b·x2 de forma legible: "3x₁ + 5x₂", "x₁ − x₂", etc.
function expr(a, b) {
  const partes = [];
  const termino = (k, x) => {
    if (Math.abs(k) < 1e-12) return;
    const m = Math.abs(k);
    const coef = Math.abs(m - 1) < 1e-12 ? '' : fmt(m);
    const signo = partes.length ? (k < 0 ? ' − ' : ' + ') : (k < 0 ? '−' : '');
    partes.push(signo + coef + x);
  };
  termino(a, 'x₁');
  termino(b, 'x₂');
  return partes.length ? partes.join('') : '0';
}

// Evita que el texto escrito por el usuario se interprete como HTML.
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const esNumero = v => v !== '' && v !== null && isFinite(v);

/* ---------- Resolución ---------- */

/**
 * Resuelve el modelo.
 * @param {object} m  { sense:'max'|'min', c:[c1,c2], nn:boolean, cons:[[a,b,op,r,nombre], ...] }
 * @returns objeto con rectas (L), semiplanos (H), vértices (V) y el estado de la solución,
 *          o { errs: [...] } si faltan datos.
 */
function resolver(m) {
  const errs = [];
  const c = m.c.map(Number);
  if (!m.c.every(esNumero)) errs.push('Completa los coeficientes de Z.');

  const COLORES = ['#8ecae6', '#ff8fab', '#b5e48c', '#ffb26b', '#cdb4ff', '#7ee0d0', '#f9c74f', '#e0e0e0'];
  const L = []; // rectas de las restricciones
  const H = []; // semiplanos de la forma h0·x1 + h1·x2 <= h2

  m.cons.forEach((k, i) => {
    if (![k[0], k[1], k[3]].every(esNumero)) { errs.push(`Completa los números de R${i + 1}.`); return; }
    const a = +k[0], b = +k[1], op = k[2], r = +k[3];
    if (a === 0 && b === 0) { errs.push(`R${i + 1} no tiene variables.`); return; }
    L.push({ a, b, r, op, name: 'R' + (i + 1), label: k[4] || '', col: COLORES[i % COLORES.length] });
    if (op !== '>=') H.push([a, b, r]);       // ≤ o =
    if (op !== '<=') H.push([-a, -b, -r]);    // ≥ o =  (se multiplica por −1)
  });
  if (errs.length) return { errs };

  // Rectas frontera: restricciones + ejes (si hay no negatividad)
  const B = L.map(l => ({ a: l.a, b: l.b, r: l.r, name: l.name }));
  if (m.nn) {
    H.push([-1, 0, 0], [0, -1, 0]);
    B.push({ a: 1, b: 0, r: 0, name: 'eje x₂' }, { a: 0, b: 1, r: 0, name: 'eje x₁' });
  }

  const cumple = p => H.every(h => h[0] * p[0] + h[1] * p[1] <= h[2] + 1e-7 * (1 + Math.abs(h[2])));

  // Intersección de cada par de rectas (regla de Cramer)
  const P = [];
  for (let i = 0; i < B.length; i++) {
    for (let j = i + 1; j < B.length; j++) {
      const p = B[i], q = B[j];
      const det = p.a * q.b - p.b * q.a;
      if (Math.abs(det) < 1e-12) continue; // rectas paralelas
      const x = (p.r * q.b - p.b * q.r) / det;
      const y = (p.a * q.r - p.r * q.a) / det;
      if (cumple([x, y]) && !P.some(o => Math.hypot(o[0] - x, o[1] - y) < 1e-7)) P.push([x, y]);
    }
  }

  // Ordena los vértices alrededor del centro para nombrarlos A, B, C... en orden
  const cx = P.reduce((s, p) => s + p[0], 0) / (P.length || 1);
  const cy = P.reduce((s, p) => s + p[1], 0) / (P.length || 1);
  P.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));

  const V = P.map((p, k) => ({
    x: p[0], y: p[1],
    z: c[0] * p[0] + c[1] * p[1],
    lab: String.fromCharCode(65 + k),
    act: B.filter(l => Math.abs(l.a * p[0] + l.b * p[1] - l.r) < 1e-7 * (1 + Math.abs(l.r))).map(l => l.name)
  }));

  const sg = m.sense === 'max' ? 1 : -1;
  if (!V.length) return { L, H, V, c, sg, status: 'infeasible' };

  // ¿Región no acotada? Se buscan direcciones d en las que se puede avanzar sin salir de la región
  // (h·d <= 0 para todo semiplano) y se mira si Z sube o baja en esa dirección.
  const dirs = [[c[0], c[1]], [-c[0], -c[1]]];
  B.forEach(l => dirs.push([l.b, -l.a], [-l.b, l.a]));
  const enCono = d => H.every(h => h[0] * d[0] + h[1] * d[1] <= EPS * Math.hypot(h[0], h[1]));
  const avanza = signo => dirs.some(d => Math.hypot(...d) > 0 && enCono(d) && signo * (c[0] * d[0] + c[1] * d[1]) > EPS);
  const up = avanza(1), down = avanza(-1);
  const unb = sg > 0 ? up : down;

  const zs = V.map(v => v.z);
  const zmax = Math.max(...zs), zmin = Math.min(...zs);
  const best = sg > 0 ? zmax : zmin;
  const opt = V.filter(v => Math.abs(v.z - best) < 1e-7 * (1 + Math.abs(best)));

  return {
    L, H, V, c, sg, best, opt, unb, up, down, zmax, zmin,
    status: unb ? 'unbounded' : opt.length > 1 ? 'multi' : 'ok'
  };
}

// Recorta un polígono con el semiplano h0·x + h1·y <= h2 (Sutherland–Hodgman).
function recortar(poly, h) {
  const out = [];
  const f = p => h[0] * p[0] + h[1] * p[1] - h[2];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = f(p), fq = f(q);
    if (fp <= EPS) out.push(p);
    if ((fp < -EPS && fq > EPS) || (fp > EPS && fq < -EPS)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

// Rango del deslizador de Z en el paso 5.
function rangoZ(S) {
  const span = (S.zmax - S.zmin) || Math.abs(S.zmax) || 10;
  const pad = span * 0.4 + 1;
  let lo = Math.min(S.zmin, 0) - pad * 0.3;
  let hi = S.zmax + pad;
  if (S.up) hi = S.zmax + span * 2 + 5;
  if (S.down) lo = S.zmin - span * 2 - 5;
  return [lo, hi];
}
