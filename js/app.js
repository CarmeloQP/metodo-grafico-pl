/*
 * app.js
 * Interfaz: lectura de datos del cuaderno, navegación por pasos, explicaciones,
 * deslizador de la recta objetivo, tabla de vértices y respuesta final.
 * Depende de solver.js y grafica.js.
 */
(function () {
  const $ = s => document.querySelector(s);
  const COLORES = ['#8ecae6', '#ff8fab', '#b5e48c', '#ffb26b', '#cdb4ff', '#7ee0d0', '#f9c74f', '#e0e0e0'];
  const PASOS = ['Plantear', 'Graficar rectas', 'Región factible', 'Vértices', 'Óptimo'];
  const CLAVE = 'metodo-grafico-pl';

  const EJEMPLOS = [
    { n: 'Puertas y ventanas', m: { sense: 'max', c: [3, 5], nn: true, v: ['puertas', 'ventanas'], zn: 'ganancia (miles $)',
      cons: [[1, 0, '<=', 4, 'Horas planta 1'], [0, 2, '<=', 12, 'Horas planta 2'], [3, 2, '<=', 18, 'Horas planta 3']] } },
    { n: 'Dieta económica', m: { sense: 'min', c: [2, 3], nn: true, v: ['porciones de A', 'porciones de B'], zn: 'costo',
      cons: [[1, 1, '>=', 4, 'Proteína'], [1, 3, '>=', 6, 'Fibra']] } },
    { n: 'Mesas y sillas', m: { sense: 'max', c: [2, 4], nn: true, v: ['mesas', 'sillas'], zn: 'utilidad',
      cons: [[1, 2, '<=', 8, 'Madera'], [3, 1, '<=', 9, 'Mano de obra']] } },
    { n: 'Caso no acotado', m: { sense: 'max', c: [1, 1], nn: true, v: ['x₁', 'x₂'], zn: 'Z',
      cons: [[1, -1, '<=', 2, ''], [0, 1, '>=', 1, '']] } },
    { n: 'Caso infactible', m: { sense: 'max', c: [3, 2], nn: true, v: ['x₁', 'x₂'], zn: 'Z',
      cons: [[1, 1, '<=', 2, ''], [1, 1, '>=', 5, '']] } }
  ];

  const copiar = o => JSON.parse(JSON.stringify(o));

  /* ---------- Estado ---------- */
  let modelo, paso = 2, zv = null, reproduccion = null, S = null, resumen = '';
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado && Array.isArray(guardado.cons)) { modelo = guardado; paso = guardado.paso || 2; }
  } catch (e) { /* sin almacenamiento local: se usa el ejemplo */ }
  if (!modelo) modelo = copiar(EJEMPLOS[0].m);
  modelo.v = modelo.v || ['x₁', 'x₂'];

  const guardar = () => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ ...modelo, paso })); } catch (e) { /* ignorar */ }
  };

  const nombreVar = i => esc(modelo.v[i] || (i ? 'x₂' : 'x₁'));
  const nombreRestr = l => l.label ? `${l.name} (${esc(l.label)})` : l.name;
  const leerNumero = v => v === '' ? '' : +v;

  /* ---------- Cuaderno (entradas) ---------- */
  function pintarEntradas() {
    $('#n1').value = modelo.v[0] || '';
    $('#n2').value = modelo.v[1] || '';
    $('#zn').value = modelo.zn || '';
    $('#c1').value = modelo.c[0];
    $('#c2').value = modelo.c[1];
    $('#nn').checked = modelo.nn;
    $('#bmax').setAttribute('aria-pressed', modelo.sense === 'max');
    $('#bmin').setAttribute('aria-pressed', modelo.sense === 'min');

    $('#cons').innerHTML = modelo.cons.map((k, i) => `
      <div class="con" data-i="${i}">
        <div class="top">
          <span class="chip" style="background:${COLORES[i % COLORES.length]};color:#1b3c31">R${i + 1}</span>
          <input type="text" data-f="4" maxlength="30" value="${esc(k[4] || '')}" placeholder="Nombre (opcional)" aria-label="Nombre de R${i + 1}">
          <button class="del" type="button" data-del="${i}" aria-label="Borrar R${i + 1}">✕</button>
        </div>
        <div class="row">
          <input type="number" step="any" inputmode="decimal" data-f="0" value="${k[0]}" aria-label="R${i + 1}: coeficiente de x1"><span class="v">x₁ +</span>
          <input type="number" step="any" inputmode="decimal" data-f="1" value="${k[1]}" aria-label="R${i + 1}: coeficiente de x2"><span class="v">x₂</span>
          <select data-f="2" aria-label="R${i + 1}: signo">${Object.keys(OPS).map(o => `<option value="${o}"${o === k[2] ? ' selected' : ''}>${OPS[o]}</option>`).join('')}</select>
          <input type="number" step="any" inputmode="decimal" data-f="3" value="${k[3]}" aria-label="R${i + 1}: lado derecho">
        </div>
      </div>`).join('');
  }

  $('#cons').addEventListener('input', e => {
    const fila = e.target.closest('[data-i]');
    if (!fila) return;
    const i = +fila.dataset.i, f = +e.target.dataset.f;
    modelo.cons[i][f] = (f === 2 || f === 4) ? e.target.value : leerNumero(e.target.value);
    zv = null; actualizar();
  });
  $('#cons').addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    modelo.cons.splice(+b.dataset.del, 1);
    zv = null; pintarEntradas(); actualizar();
  });
  $('#add').onclick = () => {
    if (modelo.cons.length >= 8) return;
    modelo.cons.push([1, 1, '<=', 10, '']);
    zv = null; pintarEntradas(); actualizar();
    const primero = $('#cons').querySelector('.con:last-child input[type=number]');
    if (primero) primero.focus();
  };
  $('#n1').oninput = e => { modelo.v[0] = e.target.value; actualizar(); };
  $('#n2').oninput = e => { modelo.v[1] = e.target.value; actualizar(); };
  $('#zn').oninput = e => { modelo.zn = e.target.value; actualizar(); };
  $('#c1').oninput = e => { modelo.c[0] = leerNumero(e.target.value); zv = null; actualizar(); };
  $('#c2').oninput = e => { modelo.c[1] = leerNumero(e.target.value); zv = null; actualizar(); };
  $('#nn').onchange = e => { modelo.nn = e.target.checked; zv = null; actualizar(); };
  $('#bmax').onclick = () => { modelo.sense = 'max'; zv = null; pintarEntradas(); actualizar(); };
  $('#bmin').onclick = () => { modelo.sense = 'min'; zv = null; pintarEntradas(); actualizar(); };

  $('#presets').innerHTML = EJEMPLOS.map((p, i) => `<button type="button" data-p="${i}">${p.n}</button>`).join('');
  $('#presets').onclick = e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    modelo = copiar(EJEMPLOS[+b.dataset.p].m);
    zv = null; paso = 2; pintarEntradas(); actualizar();
  };

  /* ---------- Gráfica ---------- */
  const svg = $('#svg');
  const redibujar = () => dibujarGrafica(svg, S, modelo, paso, zv);
  new ResizeObserver(redibujar).observe(svg);

  /* ---------- Navegación por pasos ---------- */
  function pintarPasos() {
    $('#steps').innerHTML = PASOS.map((s, i) => {
      const n = i + 1, clase = n === paso ? 'on' : n < paso ? 'done' : '';
      return `<button type="button" class="step ${clase}" data-s="${n}" aria-current="${n === paso ? 'step' : 'false'}"><b>${n}</b><span>${s}</span></button>`;
    }).join('') + `
      <div class="ctrl">
        <button class="btn" id="prev" type="button" ${paso <= 1 ? 'disabled' : ''}>← Anterior</button>
        <button class="btn y" id="next" type="button">${paso >= 5 ? 'Reproducir de nuevo' : 'Siguiente →'}</button>
      </div>`;
  }
  $('#steps').addEventListener('click', e => {
    const b = e.target.closest('[data-s]');
    if (b) { detener(); irA(+b.dataset.s); return; }
    if (e.target.id === 'prev') { detener(); irA(paso - 1); }
    else if (e.target.id === 'next') { if (paso >= 5) reproducir(); else { detener(); irA(paso + 1); } }
  });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,select,textarea')) return;
    if (e.key === 'ArrowRight') { detener(); irA(paso + 1); }
    if (e.key === 'ArrowLeft') { detener(); irA(paso - 1); }
  });
  function irA(n) { paso = Math.max(1, Math.min(5, n)); actualizar(); }
  function detener() { if (reproduccion) { clearInterval(reproduccion); reproduccion = null; } }
  function reproducir() {
    detener(); irA(1);
    reproduccion = setInterval(() => { if (paso >= 5) { detener(); return; } irA(paso + 1); }, 2600);
  }

  /* ---------- Explicación de cada paso ---------- */
  function mensajeDeslizador() {
    const lo = S.down ? -Infinity : S.zmin, hi = S.up ? Infinity : S.zmax;
    const toca = zv >= lo - EPS && zv <= hi + EPS;
    const mejor = modelo.sense === 'max' ? 'hacia la derecha (Z más grande)' : 'hacia la izquierda (Z más pequeño)';
    if (!S.unb && Math.abs(zv - S.best) < 1e-7 * (1 + Math.abs(S.best)))
      return '<b>¡Ahí está!</b> Es la última posición en que la recta todavía toca la región. Ese punto de contacto es el óptimo.';
    if (toca)
      return `La recta cruza la región: hay soluciones con Z = ${dec(zv)}. ` +
        (S.unb ? 'Por más que la muevas, siempre la toca: el problema no tiene límite.' : `Muévela ${mejor} para mejorar.`);
    const sePaso = modelo.sense === 'max' ? zv > hi : zv < lo;
    return sePaso
      ? `Ya no toca la región: ninguna combinación logra Z = ${dec(zv)}. Te pasaste; regresa un poco.`
      : `Todavía no toca la región por este lado. Muévela ${mejor}.`;
  }

  function pintarExplicacion() {
    const ex = $('#explain');
    if (S.errs) {
      ex.innerHTML = `<p class="say">Falta algo en el cuaderno</p>${S.errs.map(e => `<p class="err">${e}</p>`).join('')}`;
      return;
    }
    const nombreZ = esc(modelo.zn || 'Z');

    if (paso === 1) {
      ex.innerHTML = `<p class="say">Paso 1 · Plantear el modelo</p>
        <p>Queremos <b>${modelo.sense === 'max' ? 'maximizar' : 'minimizar'} ${nombreZ}</b>, decidiendo cuántas <b>${nombreVar(0)}</b> (x₁) y cuántas <b>${nombreVar(1)}</b> (x₂).</p>
        <ul>
          <li><span class="m">${modelo.sense === 'max' ? 'Max' : 'Min'} Z = ${expr(S.c[0], S.c[1])}</span></li>
          ${S.L.map(l => `<li><span class="m">${l.name}: ${expr(l.a, l.b)} ${OPS[l.op]} ${fmt(l.r)}</span>${l.label ? ' · ' + esc(l.label) : ''}</li>`).join('')}
          ${modelo.nn ? '<li><span class="m">x₁, x₂ ≥ 0</span> · no hay cantidades negativas, así que se trabaja en el primer cuadrante</li>' : ''}
        </ul>
        <p class="hint">Pulsa <b>Siguiente</b> para empezar a dibujar.</p>`;
    }

    if (paso === 2) {
      ex.innerHTML = `<p class="say">Paso 2 · Cada restricción es una recta</p>
        <p>Cambia el signo por “=” y busca dos puntos fáciles: dónde corta cada eje.</p>
        <ul>${S.L.map(l => `<li><b style="color:${l.col}">${nombreRestr(l)}</b>: <span class="m">${expr(l.a, l.b)} = ${fmt(l.r)}</span> →
          ${l.b ? `si x₁ = 0, x₂ = ${both(l.r / l.b)}` : 'es vertical'};
          ${l.a ? `si x₂ = 0, x₁ = ${both(l.r / l.a)}` : 'es horizontal'}.</li>`).join('')}</ul>`;
    }

    if (paso === 3) {
      ex.innerHTML = `<p class="say">Paso 3 · ¿De qué lado queda cada una?</p>
        <p>Prueba con el origen (0, 0): si cumple la desigualdad, ese lado vale. Las flechitas señalan el lado permitido.</p>
        <ul>${S.L.map(l => {
          const origen = l.op === '<=' ? 0 <= l.r : l.op === '>=' ? 0 >= l.r : l.r === 0;
          return `<li><b style="color:${l.col}">${l.name}</b>: ${l.op === '='
            ? 'es una igualdad, solo sirven los puntos sobre la recta.'
            : `0 ${OPS[l.op]} ${fmt(l.r)} es <b>${origen ? 'verdadero' : 'falso'}</b> → el lado ${origen ? 'del' : 'contrario al'} origen.`}</li>`;
        }).join('')}</ul>
        <p>${S.status === 'infeasible'
          ? '<b>Ninguna zona cumple todo a la vez:</b> la región está vacía, el problema es infactible.'
          : 'La zona rayada en amarillo cumple <b>todas</b> las restricciones a la vez: es la región factible.'}</p>`;
    }

    if (paso === 4) {
      ex.innerHTML = S.V.length
        ? `<p class="say">Paso 4 · Las esquinas mandan</p>
           <p>Si existe un óptimo, siempre está en una esquina (vértice) de la región. Encontramos ${S.V.length}:
           ${S.V.map(v => `<b>${v.lab}</b> (${both(v.x)}, ${both(v.y)})`).join(', ')}. Cada una sale de cruzar dos rectas; mira la tabla de abajo.</p>`
        : `<p class="say">Paso 4 · No hay esquinas</p><p>Como la región está vacía, no hay vértices que revisar.</p>`;
    }

    if (paso === 5) {
      if (S.status === 'infeasible') {
        ex.innerHTML = `<p class="say">Paso 5 · Sin solución</p><p>No hay ningún punto que cumpla todas las restricciones, así que no se puede optimizar Z.</p>`;
        return;
      }
      const [lo, hi] = rangoZ(S);
      if (zv === null) zv = S.unb ? (S.zmin + S.zmax) / 2 : lo + (S.best - lo) * 0.45;
      ex.innerHTML = `<p class="say">Paso 5 · Desliza la recta objetivo</p>
        <p>Todos los puntos de la recta rosada dan el mismo Z. Muévela y fíjate en el último punto de la región que toca.</p>
        <div class="slider">
          <div class="zread"><span class="hand" id="zlab">Z = ${dec(zv)}</span>${S.unb ? '' : '<button class="btn y" id="toopt" type="button">Llévame al óptimo</button>'}</div>
          <input type="range" id="zr" min="${lo}" max="${hi}" step="${(hi - lo) / 500}" value="${zv}" aria-label="Valor de Z">
          <p class="hint" id="zmsg">${mensajeDeslizador()}</p>
        </div>`;

      const refrescarZ = () => {
        $('#zlab').textContent = 'Z = ' + dec(zv);
        $('#zmsg').innerHTML = mensajeDeslizador();
        redibujar();
      };
      $('#zr').oninput = e => {
        let v = +e.target.value;
        if (!S.unb && Math.abs(v - S.best) < (hi - lo) / 80) v = S.best; // se "pega" al óptimo
        zv = v; refrescarZ();
      };
      const boton = $('#toopt');
      if (boton) boton.onclick = () => {
        const desde = zv, hasta = S.best, t0 = performance.now();
        const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const animar = ahora => {
          const u = sinMovimiento ? 1 : Math.min(1, (ahora - t0) / 900);
          zv = u >= 1 ? hasta : desde + (hasta - desde) * (1 - Math.pow(1 - u, 3));
          $('#zr').value = zv; refrescarZ();
          if (u < 1) requestAnimationFrame(animar);
        };
        requestAnimationFrame(animar);
      };
    }
  }

  /* ---------- Tabla de vértices y respuesta ---------- */
  function pintarResultados() {
    const tabla = $('#vt'), nota = $('#answer');
    if (S.errs) {
      tabla.innerHTML = '<p class="wait">Faltan datos en el cuaderno.</p>';
      nota.innerHTML = '<h2>Respuesta</h2><p>Completa los datos para resolver.</p>';
      return;
    }

    if (paso < 4) tabla.innerHTML = '<p class="wait">Se llena en el paso 4…</p>';
    else if (!S.V.length) tabla.innerHTML = '<p class="wait">No hay vértices.</p>';
    else tabla.innerHTML = `<table class="stack">
        <thead><tr><th>Vértice</th><th>Se cruzan</th><th>x₁</th><th>x₂</th><th>Z = ${expr(S.c[0], S.c[1])}</th></tr></thead>
        <tbody>${S.V.map(v => `<tr class="${paso >= 5 && S.opt && !S.unb && S.opt.includes(v) ? 'best' : ''}">
          <td>${v.lab}</td><td>${v.act.join(' y ')}</td><td class="n">${both(v.x)}</td><td class="n">${both(v.y)}</td><td class="n">${both(v.z)}</td></tr>`).join('')}
        </tbody></table>`;

    const nombreZ = esc(modelo.zn || 'Z');
    if (paso < 5) {
      nota.innerHTML = '<h2>Respuesta</h2><p class="big">¿?</p><p>Llega al paso 5 para descubrirla.</p>';
      return;
    }

    let h;
    if (S.status === 'infeasible') {
      h = '<p class="big">Infactible</p><p>Las restricciones se contradicen: no existe ninguna combinación posible.</p>';
    } else if (S.status === 'unbounded') {
      h = `<p class="big">No acotada</p><p>${nombreZ} puede ${modelo.sense === 'max' ? 'crecer' : 'bajar'} sin límite. En un problema real esto suele indicar que falta una restricción.</p>`;
    } else {
      const o = S.opt[0];
      h = `<p class="big">Z* = ${both(S.best)}</p>
        <p>Conviene tomar <b>${both(o.x)} ${nombreVar(0)}</b> y <b>${both(o.y)} ${nombreVar(1)}</b>; así se obtiene ${modelo.sense === 'max' ? 'la mayor' : 'la menor'} ${nombreZ}: <b>${both(S.best)}</b>.</p>` +
        (S.status === 'multi'
          ? `<p><b>Ojo: hay óptimos múltiples.</b> Los vértices ${S.opt.map(v => v.lab).join(' y ')} dan el mismo Z, y también cualquier punto del borde entre ellos.</p>`
          : `<p>Está en el vértice <b>${o.lab}</b>, donde se cruzan ${o.act.join(' y ')}.</p>`);
    }
    nota.innerHTML = `<h2>Respuesta</h2>${h}<button class="btn" id="copy" type="button">Copiar solución</button> <span class="small" id="copied" style="color:#7a5200"></span>`;

    resumen = `${modelo.sense === 'max' ? 'Max' : 'Min'} Z = ${expr(S.c[0], S.c[1])}\n` +
      S.L.map(l => `${l.name}: ${expr(l.a, l.b)} ${OPS[l.op]} ${fmt(l.r)}`).join('\n') +
      (modelo.nn ? '\nx₁, x₂ ≥ 0' : '') +
      `\n\nVértices:\n${S.V.map(v => `${v.lab} (${both(v.x)}, ${both(v.y)})  Z = ${both(v.z)}`).join('\n')}\n\n` +
      (S.status === 'infeasible' ? 'Problema infactible.'
        : S.status === 'unbounded' ? 'Solución no acotada.'
        : `Óptimo: x₁ = ${both(S.opt[0].x)}, x₂ = ${both(S.opt[0].y)}, Z* = ${both(S.best)}${S.status === 'multi' ? ' (óptimos múltiples)' : ''}`);

    $('#copy').onclick = async () => {
      try { await navigator.clipboard.writeText(resumen); $('#copied').textContent = '¡Copiado!'; }
      catch (e) { $('#copied').textContent = 'No se pudo copiar.'; }
    };
  }

  // En celular la tabla se muestra como tarjetas: cada celda lleva el nombre de su columna.
  new MutationObserver(() => {
    for (const c of document.querySelectorAll('.stack td:not([data-l])')) {
      let i = 0, p = c;
      while ((p = p.previousElementSibling)) i += p.colSpan;
      c.dataset.l = c.closest('table').rows[0].cells[i]?.textContent || '';
    }
  }).observe(document.body, { childList: true, subtree: true });

  /* ---------- Ciclo principal ---------- */
  function actualizar() {
    guardar();
    S = resolver(modelo);
    pintarPasos();
    pintarExplicacion();
    pintarResultados();
    redibujar();
  }

  pintarEntradas();
  actualizar();
})();
