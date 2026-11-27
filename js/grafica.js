/*
 * grafica.js
 * Dibuja el plano cartesiano en un <svg> con estilo de tablero (tiza).
 * Lo que se muestra depende del paso actual:
 *   2 → rectas y cortes con los ejes
 *   3 → región factible y flechas del lado permitido
 *   4 → vértices
 *   5 → recta objetivo (deslizable), dirección de mejora y óptimo
 */

// Paso "bonito" para las divisiones de los ejes (1, 2, 5, 10, 20...).
function pasoEje(rango) {
  const e = Math.pow(10, Math.floor(Math.log10(rango)));
  const f = rango / e;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
}

// Calcula la ventana visible (x0..x1, y0..y1) a partir de vértices y cortes con los ejes.
function calcularVentana(S, nn) {
  if (!S || S.errs) return { x0: -0.5, x1: 10, y0: -0.5, y1: 10 };
  const xs = [0], ys = [0];
  S.V.forEach(v => { xs.push(v.x); ys.push(v.y); });
  S.L.forEach(l => { if (l.a) xs.push(l.r / l.a); if (l.b) ys.push(l.r / l.b); });
  const validos = a => a.filter(v => isFinite(v) && Math.abs(v) < 1e6);
  const X = validos(xs), Y = validos(ys);
  let x1 = Math.max(...X), y1 = Math.max(...Y), x0 = Math.min(...X), y0 = Math.min(...Y);
  if (S.status === 'unbounded') { x1 += (x1 - x0) * 0.5 + 1; y1 += (y1 - y0) * 0.5 + 1; }
  if (x1 <= 0) x1 = 1;
  if (y1 <= 0) y1 = 1;
  const mx = (x1 - x0) * 0.12 || 1, my = (y1 - y0) * 0.12 || 1;
  x1 += mx; y1 += my;
  x0 = nn && x0 >= 0 ? -mx * 0.4 : x0 - mx;
  y0 = nn && y0 >= 0 ? -my * 0.4 : y0 - my;
  return { x0, x1, y0, y1 };
}

function dibujarGrafica(svg, S, modelo, paso, zv) {
  const W = svg.clientWidth, Hh = svg.clientHeight;
  if (!W || !Hh) return;

  const movil = W < 520;
  const pl = movil ? 30 : 46, pb = movil ? 28 : 38, pt = 16, pr = 18;
  const { x0, x1, y0, y1 } = calcularVentana(S, modelo.nn);

  // Conversión de coordenadas del problema a píxeles
  const sx = x => pl + (x - x0) / (x1 - x0) * (W - pl - pr);
  const sy = y => Hh - pb - (y - y0) / (y1 - y0) * (Hh - pb - pt);

  const TIZA = '#f4f1e8', CUADRO = 'rgba(244,241,232,.13)', AMARILLO = '#ffe066', ROSADO = '#ff8fab', FONDO = '#1b3c31';

  let fondo = `<defs>
    <filter id="tiza" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/>
    </filter>
    <pattern id="rayado" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
      <line x1="0" y1="0" x2="0" y2="9" stroke="rgba(255,224,102,.55)" stroke-width="2"/>
    </pattern>
    <marker id="flechaRosa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${ROSADO}"/></marker>
    <marker id="flechaTiza" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${TIZA}"/></marker>
  </defs>`;

  // Cuadrícula y números de los ejes
  const tx = pasoEje((x1 - x0) / (movil ? 5 : 9)), ty = pasoEje((y1 - y0) / (movil ? 5 : 8));
  for (let v = Math.ceil(x0 / tx) * tx; v <= x1; v += tx) {
    if (Math.abs(v) > EPS) fondo += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${pt}" y2="${Hh - pb}" stroke="${CUADRO}"/>`;
    fondo += `<text x="${sx(v)}" y="${Hh - pb + 20}" font-size="17" text-anchor="middle" fill="rgba(244,241,232,.75)" class="hand">${dec(v)}</text>`;
  }
  for (let v = Math.ceil(y0 / ty) * ty; v <= y1; v += ty) {
    if (Math.abs(v) > EPS) {
      fondo += `<line y1="${sy(v)}" y2="${sy(v)}" x1="${pl}" x2="${W - pr}" stroke="${CUADRO}"/>`;
      fondo += `<text x="${pl - 8}" y="${sy(v) + 5}" font-size="17" text-anchor="end" fill="rgba(244,241,232,.75)" class="hand">${dec(v)}</text>`;
    }
  }

  let trazos = '';   // líneas con efecto tiza
  let textos = '';   // etiquetas (sin efecto, para que se lean bien)
  const hayDatos = S && !S.errs;

  // Segmento de la recta a·x + b·y = r dentro de la ventana visible
  const segmento = (a, b, r) => {
    const P = [];
    if (b) [x0, x1].forEach(x => { const y = (r - a * x) / b; if (y >= y0 - EPS && y <= y1 + EPS) P.push([x, y]); });
    if (a) [y0, y1].forEach(y => { const x = (r - b * y) / a; if (x >= x0 - EPS && x <= x1 + EPS) P.push([x, y]); });
    if (P.length < 2) return null;
    let q = P[0];
    P.forEach(p => { if (Math.hypot(p[0] - P[0][0], p[1] - P[0][1]) > Math.hypot(q[0] - P[0][0], q[1] - P[0][1])) q = p; });
    return [P[0], q];
  };

  // Región factible: se recorta el rectángulo visible con cada semiplano
  if (hayDatos && paso >= 3) {
    let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    S.H.forEach(h => { if (poly.length) poly = recortar(poly, h); });
    if (poly.length) {
      const grueso = poly.length < 3 || S.L.some(l => l.op === '=') ? 5 : 2.5;
      trazos += `<polygon points="${poly.map(p => sx(p[0]) + ',' + sy(p[1])).join(' ')}" fill="url(#rayado)" stroke="${AMARILLO}" stroke-width="${grueso}" stroke-linejoin="round"/>`;
    }
  }

  // Ejes
  trazos += `<line x1="${sx(0)}" x2="${sx(0)}" y1="${Hh - pb}" y2="${pt}" stroke="${TIZA}" stroke-width="2.6" marker-end="url(#flechaTiza)"/>`;
  trazos += `<line y1="${sy(0)}" y2="${sy(0)}" x1="${pl}" x2="${W - pr}" stroke="${TIZA}" stroke-width="2.6" marker-end="url(#flechaTiza)"/>`;
  const nombreEje = i => {
    const n = modelo.v && modelo.v[i];
    return !movil && n && n !== (i ? 'x₂' : 'x₁') ? ' · ' + esc(n) : '';
  };
  textos += `<text x="${W - pr - 6}" y="${sy(0) - 10}" text-anchor="end" font-size="24" font-weight="700" fill="${TIZA}" class="hand">x₁${nombreEje(0)}</text>`;
  textos += `<text x="${sx(0) + 12}" y="${pt + 18}" font-size="24" font-weight="700" fill="${TIZA}" class="hand">x₂${nombreEje(1)}</text>`;

  // Rectas de las restricciones
  if (hayDatos && paso >= 2) {
    S.L.forEach((l, i) => {
      const s = segmento(l.a, l.b, l.r);
      if (!s) return;
      const [p, q] = s;
      trazos += `<line x1="${sx(p[0])}" y1="${sy(p[1])}" x2="${sx(q[0])}" y2="${sy(q[1])}" stroke="${l.col}" stroke-width="3" stroke-linecap="round"/>`;

      const t = 0.9 - 0.07 * (i % 3);
      const lx = sx(p[0] + t * (q[0] - p[0])), ly = sy(p[1] + t * (q[1] - p[1]));
      textos += `<text x="${lx + 8}" y="${ly - 8}" font-size="24" font-weight="700" fill="${l.col}" class="hand" paint-order="stroke" stroke="${FONDO}" stroke-width="5">${l.name}</text>`;

      // Paso 2: puntos de corte con los ejes
      if (paso === 2) {
        [[l.a ? l.r / l.a : NaN, 0], [0, l.b ? l.r / l.b : NaN]].forEach(c => {
          if (!isFinite(c[0]) || !isFinite(c[1])) return;
          const X = sx(c[0]), Y = sy(c[1]);
          if (X < pl - 1 || X > W - pr + 1 || Y < pt - 1 || Y > Hh - pb + 1) return;
          const derecha = X > W - 90;
          trazos += `<circle cx="${X}" cy="${Y}" r="5" fill="${l.col}"/>`;
          textos += `<text x="${X + (derecha ? -8 : 8)}" text-anchor="${derecha ? 'end' : 'start'}" y="${Y + (c[1] === 0 ? -10 : 18)}" font-size="20" fill="${l.col}" class="hand" paint-order="stroke" stroke="${FONDO}" stroke-width="5">(${dec(c[0])}, ${dec(c[1])})</text>`;
        });
      }

      // Paso 3: flecha hacia el lado que cumple la desigualdad
      if (paso === 3 && l.op !== '=') {
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        const d = l.op === '<=' ? [-l.a, -l.b] : [l.a, l.b];
        const dx = d[0] * (W - pl - pr) / (x1 - x0), dy = -d[1] * (Hh - pb - pt) / (y1 - y0);
        const n = Math.hypot(dx, dy) || 1;
        trazos += `<line x1="${sx(m[0])}" y1="${sy(m[1])}" x2="${sx(m[0]) + dx / n * 34}" y2="${sy(m[1]) + dy / n * 34}" stroke="${l.col}" stroke-width="2.6" marker-end="url(#flechaTiza)"/>`;
      }
    });
  }

  // Paso 5: recta objetivo y dirección en la que mejora Z
  if (hayDatos && paso >= 5 && S.V.length && (S.c[0] || S.c[1])) {
    if (zv !== null) {
      const s = segmento(S.c[0], S.c[1], zv);
      if (s) trazos += `<line x1="${sx(s[0][0])}" y1="${sy(s[0][1])}" x2="${sx(s[1][0])}" y2="${sy(s[1][1])}" stroke="${ROSADO}" stroke-width="3.4" stroke-dasharray="12 9" stroke-linecap="round"/>`;
    }
    const o = S.opt && !S.unb ? S.opt[0] : S.V[0];
    const dx = S.sg * S.c[0] * (W - pl - pr) / (x1 - x0), dy = -S.sg * S.c[1] * (Hh - pb - pt) / (y1 - y0);
    const n = Math.hypot(dx, dy) || 1;
    trazos += `<line x1="${sx(o.x)}" y1="${sy(o.y)}" x2="${sx(o.x) + dx / n * 52}" y2="${sy(o.y) + dy / n * 52}" stroke="${ROSADO}" stroke-width="3" marker-end="url(#flechaRosa)"/>`;
  }

  // Vértices
  if (hayDatos && paso >= 4) {
    S.V.forEach(v => {
      const esOptimo = paso >= 5 && S.opt && !S.unb && S.opt.includes(v);
      const X = sx(v.x), Y = sy(v.y);
      trazos += esOptimo
        ? `<circle cx="${X}" cy="${Y}" r="15" fill="none" stroke="${ROSADO}" stroke-width="3"/><circle cx="${X}" cy="${Y}" r="6" fill="${ROSADO}"/>`
        : `<circle cx="${X}" cy="${Y}" r="6" fill="${TIZA}"/>`;
      const derecha = X < W - 150;
      const texto = movil ? v.lab : `${v.lab} (${dec(v.x)}, ${dec(v.y)})`;
      textos += `<text x="${X + (derecha ? 16 : -16)}" y="${Y - 14}" text-anchor="${derecha ? 'start' : 'end'}" font-size="${esOptimo ? 28 : 23}" font-weight="700" fill="${esOptimo ? ROSADO : TIZA}" class="hand" paint-order="stroke" stroke="${FONDO}" stroke-width="6">${texto}</text>`;
    });
  }

  if (!hayDatos) textos += `<text x="${W / 2}" y="${Hh / 2}" text-anchor="middle" font-size="30" fill="${AMARILLO}" class="hand">Completa los datos en el cuaderno</text>`;

  svg.innerHTML = fondo + `<g filter="url(#tiza)">${trazos}</g>` + textos;
}
