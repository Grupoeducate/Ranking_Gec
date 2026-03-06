/* ═══════════════════════════════════════════════════════════════
   GRUPO EDÚCATE COLOMBIA — Sistema de Consulta Saber 11
   js/app.js · v4.0
═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── CONFIGURACIÓN ───────────────────────────────────────────
const CONFIG = {
  anioMin: 2014,
  anioMax: 2025,          // se ajusta automáticamente
  porPagina: 25,
  maxSeleccion: 3,
  maxSugerencias: 3,
  rutaData: './data/data_',
};

// ─── ESTADO GLOBAL ───────────────────────────────────────────
const estado = {
  anioActual:    null,
  modoHistorico: false,
  dataActual:    [],      // JSON del año seleccionado
  dataFiltrada:  [],      // resultado de filtros modo normal
  paginaActual:  1,
  cache:         {},      // { 2024: [...], 2025: [...] }
  seleccionados: [],      // DANEs seleccionados para comparar (máx. 3)
  historico:     [],      // filas consolidadas modo histórico
  colegioBase:   null,    // { cod_dane, nombre, municipio, departamento }
  paginaHistorico: 1,
  aniosDisponibles: [],
  mpioValor:     'TODOS', // valor seleccionado del municipio
  mpioLabel:     'Todos', // etiqueta del municipio
};

// ─── REFERENCIAS DOM ─────────────────────────────────────────
const $ = id => document.getElementById(id);

const dom = {
  selAnio:          () => $('selectAnio'),
  selDepto:         () => $('selectDepto'),
  selClasif:        () => $('selectClasif'),
  mpioDisplay:      () => $('mpioDisplay'),
  mpioDropdown:     () => $('mpioDropdown'),
  mpioSearch:       () => $('mpioSearch'),
  mpioList:         () => $('mpioList'),
  inputBusqueda:    () => $('inputBusqueda'),
  buscadorClear:    () => $('buscadorClear'),
  bloqueHistorico:  () => $('bloqueHistorico'),
  bloqueNormal:     () => $('bloqueNormal'),
  inputDane:        () => $('inputDaneHistorico'),
  listaSugerencias: () => $('listaSugerencias'),
  btnGenerar:       () => $('btnGenerarHistorico'),
  btnExcelHist:     () => $('btnExcelHistorico'),
  btnExcelNormal:   () => $('btnExcelNormal'),
  btnComparar:      () => $('btnComparar'),
  countSel:         () => $('countSelected'),
  modoBadge:        () => $('modoBadge'),
  cuerpoTabla:      () => $('cuerpoTabla'),
  cuerpoHistorico:  () => $('cuerpoTablaHistorica'),
  paginacion:       () => $('paginacion'),
  paginacionHist:   () => $('paginacionHistorica'),
  contadorNormal:   () => $('contadorNormal'),
  contadorHist:     () => $('contadorHistorico'),
  seccionNormal:    () => $('seccionTablaNormal'),
  seccionHistorica: () => $('seccionTablaHistorica'),
  ctxBanner:        () => $('ctxBanner'),
  ctxTitulo:        () => $('ctxTitulo'),
  ctxSub:           () => $('ctxSub'),
  estadoVacio:      () => $('estadoVacio'),
  estadoCargando:   () => $('estadoCargando'),
  estadoVacioH:     () => $('estadoVacioH'),
  estadoCargandoH:  () => $('estadoCargandoH'),
  modalComp:        () => $('modalComparacion'),
  modalError:       () => $('modalError'),
  modalErrorMsg:    () => $('modalErrorMsg'),
  chartCanvas:      () => $('chartComparacion'),
  indiceBtns:       () => document.querySelectorAll('.indice-btn'),
};

// ─── CHART ───────────────────────────────────────────────────
let myChart = null;
let indiceActivo = 'indice_total';

const INDICES = {
  indice_total:                    { label: 'Índice Total',          color: ['#11678B','#17334B','#54BBAB'] },
  'indice de Matemática':          { label: 'Matemática',            color: ['#F39325','#D94D15','#878721'] },
  'indice de Lectura Crítica':     { label: 'Lectura Crítica',       color: ['#11678B','#17334B','#54BBAB'] },
  'indice de Sociales y Ciudadanas': { label: 'Sociales',            color: ['#B01829','#521537','#D94D15'] },
  'indice de Ciencias Naturales':  { label: 'Ciencias Naturales',    color: ['#54BBAB','#11678B','#17334B'] },
  'indice de Inglés':              { label: 'Inglés',                color: ['#878721','#F39325','#B01829'] },
};

const DEPT_COLOMBIA = [
  'AMAZONAS','ANTIOQUIA','ARAUCA','ATLÁNTICO','BOGOTÁ','BOLÍVAR','BOYACÁ',
  'CALDAS','CAQUETÁ','CASANARE','CAUCA','CESAR','CHOCÓ','CÓRDOBA',
  'CUNDINAMARCA','GUAINÍA','GUAVIARE','HUILA','LA GUAJIRA','MAGDALENA',
  'META','NARIÑO','NORTE DE SANTANDER','PUTUMAYO','QUINDÍO','RISARALDA',
  'SAN ANDRÉS','SANTANDER','SUCRE','TOLIMA','VALLE DEL CAUCA','VAUPÉS','VICHADA'
];

// ═══════════════════════════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  await detectarAnioMaximo();
  inicializarSelectores();
  inicializarMunicipio();
  inicializarEventos();
  await cargarAnio(estado.anioActual);
});

// ─── DETECTAR AÑO MÁXIMO ────────────────────────────────────
async function detectarAnioMaximo() {
  for (let a = CONFIG.anioMax; a >= CONFIG.anioMin; a--) {
    try {
      const r = await fetch(`${CONFIG.rutaData}${a}.json`, { method: 'HEAD' });
      if (r.ok) { estado.anioActual = a; break; }
    } catch { /* continúa */ }
  }
  if (!estado.anioActual) estado.anioActual = CONFIG.anioMax;

  // Detectar todos los años disponibles
  for (let a = CONFIG.anioMin; a <= CONFIG.anioMax; a++) {
    try {
      const r = await fetch(`${CONFIG.rutaData}${a}.json`, { method: 'HEAD' });
      if (r.ok) estado.aniosDisponibles.push(a);
    } catch { /* continúa */ }
  }

  // Fallback: si no hay servidor, usar rango completo
  if (!estado.aniosDisponibles.length) {
    estado.aniosDisponibles = Array.from({length: CONFIG.anioMax - CONFIG.anioMin + 1}, (_,i) => CONFIG.anioMin + i);
  }
}

// ─── INICIALIZAR SELECTORES ──────────────────────────────────
function inicializarSelectores() {
  const sel = dom.selAnio();

  // Opción "Todos" primero
  const optTodos = document.createElement('option');
  optTodos.value = 'TODOS'; optTodos.textContent = 'Todos los años';
  sel.appendChild(optTodos);

  // Años de mayor a menor
  [...estado.aniosDisponibles].reverse().forEach(a => {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    if (a === estado.anioActual) o.selected = true;
    sel.appendChild(o);
  });

  // Departamentos
  const selDep = dom.selDepto();
  DEPT_COLOMBIA.forEach(d => {
    const o = document.createElement('option');
    o.value = d; o.textContent = d;
    selDep.appendChild(o);
  });
}

// ─── MUNICIPIO PERSONALIZADO ─────────────────────────────────
function inicializarMunicipio() {
  const display  = dom.mpioDisplay();
  const dropdown = dom.mpioDropdown();
  const search   = dom.mpioSearch();
  const list     = dom.mpioList();

  // Abrir/cerrar
  display.addEventListener('click', () => {
    if (display.classList.contains('disabled')) return;
    const open = dropdown.classList.toggle('open');
    display.classList.toggle('open', open);
    if (open) { search.value = ''; filtrarListaMpio(''); search.focus(); }
  });

  // Filtrar mientras escribe
  search.addEventListener('input', () => filtrarListaMpio(search.value));

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.municipio-wrap')) {
      dropdown.classList.remove('open');
      display.classList.remove('open');
    }
  });
}

function llenarMunicipios(mpios) {
  const list = dom.mpioList();
  list.innerHTML = '';

  // Opción "Todos"
  const li0 = document.createElement('li');
  li0.textContent = 'Todos'; li0.dataset.valor = 'TODOS';
  if (estado.mpioValor === 'TODOS') li0.classList.add('selected');
  li0.addEventListener('click', () => seleccionarMpio('TODOS', 'Todos'));
  list.appendChild(li0);

  mpios.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m; li.dataset.valor = m;
    if (estado.mpioValor === m) li.classList.add('selected');
    li.addEventListener('click', () => seleccionarMpio(m, m));
    list.appendChild(li);
  });
}

function filtrarListaMpio(q) {
  const items = dom.mpioList().querySelectorAll('li');
  const lower = q.toLowerCase();
  items.forEach(li => {
    li.classList.toggle('hidden', q !== '' && !li.textContent.toLowerCase().includes(lower));
  });
}

function seleccionarMpio(valor, label) {
  estado.mpioValor = valor;
  estado.mpioLabel = label;
  dom.mpioDisplay().textContent = label;
  dom.mpioDropdown().classList.remove('open');
  dom.mpioDisplay().classList.remove('open');
  // Marcar selected
  dom.mpioList().querySelectorAll('li').forEach(li => {
    li.classList.toggle('selected', li.dataset.valor === valor);
  });
  filtrar();
}

function habilitarMunicipio(habilitar) {
  const d = dom.mpioDisplay();
  if (habilitar) d.classList.remove('disabled');
  else { d.classList.add('disabled'); seleccionarMpio('TODOS','Todos'); }
}

// ─── EVENTOS ──────────────────────────────────────────────────
function inicializarEventos() {
  dom.selAnio().addEventListener('change', onAnioChange);
  dom.selDepto().addEventListener('change', onDeptoChange);
  dom.selClasif().addEventListener('change', filtrar);
  dom.inputBusqueda().addEventListener('input', onBusqueda);
  dom.inputDane().addEventListener('input', onDaneInput);
  dom.btnGenerar().addEventListener('click', generarReporteHistorico);
  dom.btnExcelHist().addEventListener('click', exportarExcelHistorico);
  dom.btnExcelNormal().addEventListener('click', exportarExcelNormal);
  dom.btnComparar().addEventListener('click', abrirModalComparacion);

  // Selector de índice en modal
  dom.indiceBtns().forEach(btn => {
    btn.addEventListener('click', () => {
      dom.indiceBtns().forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      indiceActivo = btn.dataset.indice;
      renderChart();
    });
  });

  // Exportar gráfica
  $('btnExportarChart').addEventListener('click', exportarChart);
  $('btnCerrarModal').addEventListener('click', () => cerrarModal('modalComparacion'));
  $('btnCerrarError').addEventListener('click', () => cerrarModal('modalError'));
}

// ─── CAMBIO DE AÑO ────────────────────────────────────────────
async function onAnioChange() {
  const val = dom.selAnio().value;
  estado.modoHistorico = (val === 'TODOS');
  actualizarModo();

  if (!estado.modoHistorico) {
    estado.anioActual = parseInt(val);
    await cargarAnio(estado.anioActual);
  } else {
    limpiarTablaHistorico();
  }
}

function actualizarModo() {
  const hist = estado.modoHistorico;
  const badge = dom.modoBadge();

  badge.className = 'modo-badge ' + (hist ? 'modo-badge--historico' : 'modo-badge--normal');
  badge.textContent = hist ? '📅 Modo: Histórico municipal' : '⚡ Modo: Año específico';

  // Bloque histórico
  dom.bloqueHistorico().classList.toggle('visible', hist);

  // Buscador normal
  dom.bloqueNormal().classList.toggle('hidden', hist);

  // Filtros
  dom.selDepto().disabled  = hist;
  dom.selClasif().disabled = hist;
  habilitarMunicipio(!hist);

  // Secciones tabla
  dom.seccionNormal().classList.toggle('hidden', hist);
  dom.seccionHistorica().classList.toggle('hidden', !hist);

  // Botones
  dom.btnExcelNormal().classList.toggle('hidden', hist);
  dom.btnComparar().disabled = true;
  dom.countSel().textContent = '0';
  estado.seleccionados = [];

  if (!hist) {
    dom.ctxBanner().classList.remove('visible');
    dom.btnExcelHist().disabled = true;
  }
}

// ─── CARGAR AÑO ───────────────────────────────────────────────
async function cargarAnio(anio) {
  if (estado.cache[anio]) {
    estado.dataActual = estado.cache[anio];
    actualizarMpiosDepto();
    filtrar();
    return;
  }

  mostrarCargando(true);
  try {
    const res = await fetch(`${CONFIG.rutaData}${anio}.json`);
    if (!res.ok) throw new Error('not found');
    estado.dataActual = await res.json();
    estado.cache[anio] = estado.dataActual;
  } catch {
    showToast(`⚠️ No se encontró data_${anio}.json`, 'warn');
    estado.dataActual = generarDatosDemo(anio);
    estado.cache[anio] = estado.dataActual;
  }
  mostrarCargando(false);
  actualizarMpiosDepto();
  filtrar();
}

// ─── DEPARTAMENTO ─────────────────────────────────────────────
function onDeptoChange() {
  estado.mpioValor = 'TODOS';
  estado.mpioLabel = 'Todos';
  dom.mpioDisplay().textContent = 'Todos';
  actualizarMpiosDepto();
  filtrar();
}

function actualizarMpiosDepto() {
  const dep = dom.selDepto().value;
  const mpios = [...new Set(
    estado.dataActual
      .filter(d => dep === 'TODOS' || d.departamento === dep)
      .map(d => d.municipio)
  )].sort();
  llenarMunicipios(mpios);
}

// ─── BUSCADOR ─────────────────────────────────────────────────
function onBusqueda() {
  const val = dom.inputBusqueda().value;
  dom.buscadorClear().classList.toggle('visible', val.length > 0);
  filtrar();
}

window.limpiarBusqueda = function() {
  dom.inputBusqueda().value = '';
  dom.buscadorClear().classList.remove('visible');
  filtrar();
};

// ─── FILTRAR (modo normal) ────────────────────────────────────
function filtrar() {
  if (estado.modoHistorico) return;

  const dep = dom.selDepto().value;
  const mpi = estado.mpioValor;
  const cla = dom.selClasif().value;
  const bus = dom.inputBusqueda().value.toLowerCase().trim();

  estado.dataFiltrada = estado.dataActual.filter(d =>
    (dep === 'TODOS' || d.departamento === dep) &&
    (mpi === 'TODOS' || d.municipio    === mpi) &&
    (cla === 'TODOS' || d.clasificacion === cla) &&
    (!bus || d.nombre.toLowerCase().includes(bus) || String(d.cod_dane).includes(bus))
  );

  estado.paginaActual = 1;
  dibujarTablaNormal();
}

// ─── DIBUJAR TABLA NORMAL ────────────────────────────────────
function dibujarTablaNormal() {
  const data   = estado.dataFiltrada;
  const tbody  = dom.cuerpoTabla();
  const total  = data.length;
  const inicio = (estado.paginaActual - 1) * CONFIG.porPagina;
  const fin    = Math.min(inicio + CONFIG.porPagina, total);
  const slice  = data.slice(inicio, fin);

  tbody.innerHTML = '';

  if (!slice.length) {
    mostrarEstado('vacio', false);
    mostrarEstado('vacio', true);
    dom.contadorNormal().textContent = '0 resultados';
    renderPaginacion(0, 'normal');
    return;
  }

  mostrarEstado('vacio', false);
  dom.contadorNormal().textContent = `${total.toLocaleString()} institución${total !== 1 ? 'es' : ''}`;

  slice.forEach(x => {
    const clasif = (x.clasificacion || '').replace('+', 'p');
    const esSel  = estado.seleccionados.includes(x.cod_dane);
    const bloqueado = !esSel && estado.seleccionados.length >= CONFIG.maxSeleccion;

    const tr = document.createElement('tr');
    tr.dataset.dane = x.cod_dane;
    tr.innerHTML = `
      <td class="text-center" style="padding:10px 8px">
        <input type="checkbox" class="check-sel"
          data-dane="${x.cod_dane}"
          ${esSel ? 'checked' : ''}
          ${bloqueado ? 'disabled' : ''}
          onchange="toggleSeleccion('${x.cod_dane}', this)"
        />
      </td>
      <td class="celda-nombre">
        <span class="celda-nombre__name" title="${x.nombre}">${x.nombre}</span>
        <div class="celda-nombre__meta">
          <span class="celda-nombre__dane mono">DANE: ${x.cod_dane}</span>
          <span class="celda-nombre__sep">|</span>
          <span class="celda-nombre__ranking">Nal. #${x.ranking_nacional || '—'}</span>
        </div>
      </td>
      <td class="text-center" style="padding:10px 14px">
        <span class="cat-chip cat-${clasif}">${x.clasificacion || '—'}</span>
      </td>
      <td class="celda-num celda-num--total">${pf(x.indice_total)}</td>
      <td class="celda-num">${parseInt(x.evaluados_3anios || 0).toLocaleString()}</td>
      <td class="celda-num">${pf(x['indice de Lectura Crítica'])}</td>
      <td class="celda-num">${pf(x['indice de Matemática'])}</td>
      <td class="celda-num">${pf(x['indice de Sociales y Ciudadanas'])}</td>
      <td class="celda-num">${pf(x['indice de Ciencias Naturales'])}</td>
      <td class="celda-num">${pf(x['indice de Inglés'])}</td>
      <td class="text-center" style="padding:10px 8px">
        <button class="btn-tendencia" onclick="verTendencia('${x.cod_dane}','${escapar(x.nombre)}')" title="Ver tendencia histórica">📈</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginacion(total, 'normal');
}

// ─── SELECCIÓN PARA COMPARAR ─────────────────────────────────
window.toggleSeleccion = function(dane, el) {
  if (el.checked) {
    if (estado.seleccionados.length >= CONFIG.maxSeleccion) {
      el.checked = false;
      showToast(`Máximo ${CONFIG.maxSeleccion} colegios para comparar`, 'warn');
      return;
    }
    estado.seleccionados.push(dane);
  } else {
    estado.seleccionados = estado.seleccionados.filter(d => d !== dane);
  }

  const n = estado.seleccionados.length;
  dom.countSel().textContent = n;
  dom.btnComparar().disabled = (n < 2);

  // Actualizar checkboxes bloqueados
  document.querySelectorAll('.check-sel').forEach(cb => {
    const d = cb.dataset.dane;
    if (!estado.seleccionados.includes(d)) {
      cb.disabled = (estado.seleccionados.length >= CONFIG.maxSeleccion);
    }
  });
};

// ─── TENDENCIA (modal histórico individual) ───────────────────
window.verTendencia = async function(dane, nombre) {
  $('modalTendenciaNombre').textContent = nombre;
  $('modalTendenciaDane').textContent   = `DANE: ${dane}`;
  abrirModal('modalTendencia');
  $('spinnerTendencia').classList.remove('hidden');
  $('chartTendenciaWrap').classList.add('hidden');

  const vals = [];
  for (const a of estado.aniosDisponibles) {
    try {
      const data = await obtenerCache(a);
      const reg  = data.find(r => r.cod_dane === dane);
      vals.push({ anio: a, val: reg ? parseFloat(reg.indice_total) : null });
    } catch { vals.push({ anio: a, val: null }); }
  }

  $('spinnerTendencia').classList.add('hidden');
  $('chartTendenciaWrap').classList.remove('hidden');
  renderChartTendencia(vals);
};

let chartTendencia = null;
function renderChartTendencia(vals) {
  const ctx = $('chartTendencia').getContext('2d');
  if (chartTendencia) chartTendencia.destroy();
  chartTendencia = new Chart(ctx, {
    type: 'line',
    data: {
      labels: vals.map(v => v.anio),
      datasets: [{
        label: 'Índice Total',
        data: vals.map(v => v.val),
        borderColor: '#11678B',
        backgroundColor: 'rgba(17,103,139,0.10)',
        borderWidth: 3,
        pointRadius: 6,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#11678B',
        pointBorderWidth: 2,
        tension: 0.3,
        fill: true,
        spanGaps: true,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

$('btnExportarTendencia') && ($('btnExportarTendencia').onclick = () => {
  const link = document.createElement('a');
  link.download = `Tendencia_${$('modalTendenciaDane').textContent}.jpg`;
  link.href = $('chartTendencia').toDataURL('image/jpeg', 0.95);
  link.click();
});

// ─── COMPARACIÓN 3 COLEGIOS ───────────────────────────────────
function abrirModalComparacion() {
  if (estado.seleccionados.length < 2) return;

  // Obtener datos de seleccionados
  const registros = estado.seleccionados.map(dane => {
    return estado.dataActual.find(r => r.cod_dane === dane);
  }).filter(Boolean);

  // Nombres en cabecera modal
  $('comparNombres').innerHTML = registros.map((r,i) =>
    `<span style="color:${['#11678B','#54BBAB','#F39325'][i]};font-weight:800">${r.nombre.substring(0,30)}</span>`
  ).join(' vs ');

  abrirModal('modalComparacion');

  // Activar primer botón índice
  dom.indiceBtns().forEach((b,i) => b.classList.toggle('active', i === 0));
  indiceActivo = 'indice_total';
  renderChart();
}

function renderChart() {
  const ctx  = dom.chartCanvas().getContext('2d');
  if (myChart) myChart.destroy();

  const registros = estado.seleccionados.map(dane =>
    estado.dataActual.find(r => r.cod_dane === dane)
  ).filter(Boolean);

  const colores = ['#11678B','#54BBAB','#F39325'];
  const datasets = registros.map((r, i) => ({
    label: r.nombre.substring(0, 35),
    data: [parseFloat(r[indiceActivo] || r.indice_total || 0)],
    backgroundColor: colores[i] + '22',
    borderColor: colores[i],
    borderWidth: 3,
    pointRadius: 8,
    pointBackgroundColor: '#fff',
    pointBorderColor: colores[i],
    pointBorderWidth: 3,
  }));

  myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [INDICES[indiceActivo]?.label || indiceActivo],
      datasets,
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Barlow Condensed', size: 13, weight: '600' } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(4)}`
          }
        }
      },
      scales: {
        y: { beginAtZero: false, min: 0.5, max: 1.0, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function exportarChart() {
  const link = document.createElement('a');
  link.download = `Comparacion_${estado.anioActual}.jpg`;
  link.href = dom.chartCanvas().toDataURL('image/jpeg', 0.95);
  link.click();
}

// ─── MODO HISTÓRICO ───────────────────────────────────────────

// Autocomplete DANE
async function onDaneInput() {
  const q   = dom.inputDane().value.trim().toLowerCase();
  const ul  = dom.listaSugerencias();

  if (q.length < 3) { ul.classList.remove('open'); return; }

  // Buscar en el año actual como índice de colegios
  const fuente = estado.dataActual.length ? estado.dataActual : (await obtenerCache(estado.anioActual));
  const matches = fuente.filter(r =>
    r.nombre.toLowerCase().includes(q) || String(r.cod_dane).includes(q)
  ).slice(0, CONFIG.maxSugerencias);

  ul.innerHTML = '';
  if (!matches.length) { ul.classList.remove('open'); return; }

  matches.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="autocomplete-list__nombre">${r.nombre}</div>
      <div class="autocomplete-list__dane">DANE: ${r.cod_dane} · ${r.municipio}</div>
    `;
    li.addEventListener('click', () => {
      dom.inputDane().value = r.cod_dane;
      ul.classList.remove('open');
    });
    ul.appendChild(li);
  });
  ul.classList.add('open');

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.autocomplete-wrap')) ul.classList.remove('open');
  }, { once: true });
}

// Generar reporte histórico
async function generarReporteHistorico() {
  const dane = dom.inputDane().value.trim();
  if (!dane) { showToast('Ingresa un código DANE', 'warn'); return; }

  dom.listaSugerencias().classList.remove('open');
  mostrarCargandoH(true);
  limpiarTablaHistorico();

  // Buscar colegio base en cualquier año
  let base = null;
  for (const a of [...estado.aniosDisponibles].reverse()) {
    const data = await obtenerCache(a);
    const reg  = data.find(r => r.cod_dane === dane || r.nombre.toLowerCase() === dane.toLowerCase());
    if (reg) { base = reg; break; }
  }

  if (!base) {
    mostrarCargandoH(false);
    $('modalErrorMsg').textContent = `El código DANE "${dane}" no aparece en los registros históricos ${CONFIG.anioMin}–${estado.anioActual}. Verifica el número o el año de creación del colegio.`;
    abrirModal('modalError');
    return;
  }

  estado.colegioBase = base;
  const municipio    = base.municipio;
  const deptoBase    = base.departamento;

  // Construir filas históricas
  const filas = [];
  for (const a of [...estado.aniosDisponibles].sort((x,y) => y - x)) {
    const data   = await obtenerCache(a);
    const colegs = data.filter(r => r.municipio === municipio).sort((x,y) => (x.ranking_municipio||99) - (y.ranking_municipio||99));

    if (!colegs.length) continue;

    colegs.forEach(r => {
      filas.push({
        anio:                r.anio || a,
        municipio:           r.municipio,
        departamento:        r.departamento,
        nombre:              r.nombre,
        cod_dane:            r.cod_dane,
        clasificacion:       r.clasificacion   || 'N/A',
        sector:              r.sector          || 'N/A',
        ranking_municipio:   r.ranking_municipio   || 'N/A',
        ranking_departamento:r.ranking_departamento || 'N/A',
        ranking_nacional:    r.ranking_nacional     || 'N/A',
        indice_total:        r.indice_total     || 'N/A',
        lect:                r['indice de Lectura Crítica']      || 'N/A',
        mate:                r['indice de Matemática']           || 'N/A',
        soc:                 r['indice de Sociales y Ciudadanas']|| 'N/A',
        cien:                r['indice de Ciencias Naturales']   || 'N/A',
        ing:                 r['indice de Inglés']               || 'N/A',
        esBase:              r.cod_dane === base.cod_dane,
      });
    });
  }

  estado.historico     = filas;
  estado.paginaHistorico = 1;
  mostrarCargandoH(false);

  // Banner contexto
  const banner = dom.ctxBanner();
  banner.classList.add('visible');
  dom.ctxTitulo().textContent = `Municipio: ${municipio} · ${deptoBase}`;
  dom.ctxSub().textContent    = `Colegio base: ${base.nombre} · DANE: ${base.cod_dane} · Años: ${Math.min(...estado.aniosDisponibles)}–${Math.max(...estado.aniosDisponibles)}`;

  dibujarTablaHistorica();
  dom.btnExcelHist().disabled = false;
  showToast(`✓ ${filas.length} registros cargados`, 'ok');
}

function limpiarTablaHistorico() {
  estado.historico = [];
  estado.colegioBase = null;
  if (dom.cuerpoHistorico()) dom.cuerpoHistorico().innerHTML = '';
  dom.ctxBanner().classList.remove('visible');
  dom.btnExcelHist().disabled = true;
  renderPaginacion(0, 'historico');
  dom.contadorHist() && (dom.contadorHist().textContent = '0 registros');
}

// ─── DIBUJAR TABLA HISTÓRICA ──────────────────────────────────
function dibujarTablaHistorica() {
  const filas  = estado.historico;
  const tbody  = dom.cuerpoHistorico();
  const total  = filas.length;
  const inicio = (estado.paginaHistorico - 1) * CONFIG.porPagina;
  const fin    = Math.min(inicio + CONFIG.porPagina, total);
  const slice  = filas.slice(inicio, fin);

  tbody.innerHTML = '';

  let anioAnterior = null;

  slice.forEach(f => {
    // Separador de año
    if (f.anio !== anioAnterior) {
      const sep = document.createElement('tr');
      sep.className = 'year-separator';
      sep.innerHTML = `<td colspan="15">▶ ${f.anio}</td>`;
      tbody.appendChild(sep);
      anioAnterior = f.anio;
    }

    const clasif = (f.clasificacion || '').replace('+','p');
    const tr = document.createElement('tr');
    if (f.esBase) tr.classList.add('fila-base');

    tr.innerHTML = `
      <td class="celda-num">${f.anio}</td>
      <td class="celda-num">${f.municipio}</td>
      <td class="celda-nombre">
        <span class="celda-nombre__name" title="${f.nombre}">
          ${f.esBase ? '⭐ ' : ''}${f.nombre}
        </span>
      </td>
      <td class="celda-num mono" style="font-size:.7rem">${f.cod_dane}</td>
      <td class="text-center" style="padding:8px 10px">
        <span class="cat-chip cat-${clasif}">${f.clasificacion}</span>
      </td>
      <td class="celda-num">${f.sector}</td>
      <td class="celda-num">${f.ranking_municipio}</td>
      <td class="celda-num">${f.ranking_departamento}</td>
      <td class="celda-num">${f.ranking_nacional}</td>
      <td class="celda-num celda-num--total">${pfH(f.indice_total)}</td>
      <td class="celda-num">${pfH(f.lect)}</td>
      <td class="celda-num">${pfH(f.mate)}</td>
      <td class="celda-num">${pfH(f.soc)}</td>
      <td class="celda-num">${pfH(f.cien)}</td>
      <td class="celda-num">${pfH(f.ing)}</td>
    `;
    tbody.appendChild(tr);
  });

  dom.contadorHist() && (dom.contadorHist().textContent = `${total.toLocaleString()} registros`);
  renderPaginacion(total, 'historico');
}

// ─── PAGINACIÓN ───────────────────────────────────────────────
function renderPaginacion(total, modo) {
  const porPag   = CONFIG.porPagina;
  const totalPag = Math.ceil(total / porPag);
  const paginaAct = modo === 'normal' ? estado.paginaActual : estado.paginaHistorico;
  const contenedor = modo === 'normal' ? dom.paginacion() : dom.paginacionHist();

  if (!contenedor) return;
  contenedor.innerHTML = '';
  if (totalPag <= 1) return;

  const crearBtn = (txt, pagina, activo = false, deshabilitado = false) => {
    const btn = document.createElement('button');
    btn.className = 'pag-btn' + (activo ? ' active' : '');
    btn.textContent = txt;
    btn.disabled = deshabilitado;
    btn.addEventListener('click', () => irPagina(pagina, modo));
    return btn;
  };

  contenedor.appendChild(crearBtn('‹', paginaAct - 1, false, paginaAct === 1));

  // Páginas con ventana
  const rango = paginasRango(paginaAct, totalPag);
  rango.forEach(p => {
    if (p === '…') {
      const span = document.createElement('span');
      span.className = 'pag-info'; span.textContent = '…';
      contenedor.appendChild(span);
    } else {
      contenedor.appendChild(crearBtn(p, p, p === paginaAct));
    }
  });

  contenedor.appendChild(crearBtn('›', paginaAct + 1, false, paginaAct === totalPag));

  // Info
  const info = document.createElement('span');
  info.className = 'pag-info';
  const ini = (paginaAct - 1) * porPag + 1;
  const fin = Math.min(paginaAct * porPag, total);
  info.textContent = `${ini}–${fin} de ${total}`;
  contenedor.appendChild(info);
}

function paginasRango(actual, total) {
  const delta = 2;
  const range = [];
  for (let i = Math.max(2, actual - delta); i <= Math.min(total - 1, actual + delta); i++) range.push(i);
  if (actual - delta > 2) range.unshift('…');
  if (actual + delta < total - 1) range.push('…');
  range.unshift(1);
  if (total > 1) range.push(total);
  return range;
}

function irPagina(pag, modo) {
  if (modo === 'normal') {
    estado.paginaActual = pag;
    dibujarTablaNormal();
  } else {
    estado.paginaHistorico = pag;
    dibujarTablaHistorica();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── EXPORTAR EXCEL (modo normal) ─────────────────────────────
function exportarExcelNormal() {
  if (!estado.dataFiltrada.length) { showToast('No hay datos para exportar', 'warn'); return; }

  const anio = estado.anioActual;
  const filas = estado.dataFiltrada.map(r => ({
    'Año':                  anio,
    'Código DANE':          r.cod_dane,
    'Institución':          r.nombre,
    'Departamento':         r.departamento,
    'Municipio':            r.municipio,
    'Sector':               r.sector,
    'Categoría':            r.clasificacion,
    'Puesto Nacional':      r.ranking_nacional,
    'Puesto Depto':         r.ranking_departamento,
    'Puesto Municipal':     r.ranking_municipio,
    'Evaluados':            r.evaluados_3anios,
    'Índice Total':         parseFloat(r.indice_total) || 0,
    'Lectura Crítica':      parseFloat(r['indice de Lectura Crítica']) || 0,
    'Matemática':           parseFloat(r['indice de Matemática']) || 0,
    'Sociales':             parseFloat(r['indice de Sociales y Ciudadanas']) || 0,
    'Ciencias Naturales':   parseFloat(r['indice de Ciencias Naturales']) || 0,
    'Inglés':               parseFloat(r['indice de Inglés']) || 0,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);
  estilarHoja(ws, filas.length);
  XLSX.utils.book_append_sheet(wb, ws, `Saber11_${anio}`);
  XLSX.writeFile(wb, `Saber11_${anio}_Educate.xlsx`);
  showToast('✓ Excel exportado', 'ok');
}

// ─── EXPORTAR EXCEL (modo histórico) ─────────────────────────
async function exportarExcelHistorico() {
  if (!estado.historico.length || !estado.colegioBase) {
    showToast('Genera el reporte primero', 'warn'); return;
  }

  showToast('Generando Excel…', 'ok');
  const wb = XLSX.utils.book_new();

  // Agrupar por año
  const porAnio = {};
  estado.historico.forEach(f => {
    if (!porAnio[f.anio]) porAnio[f.anio] = [];
    porAnio[f.anio].push(f);
  });

  // Una hoja por año
  Object.keys(porAnio).sort((a,b) => b - a).forEach(anio => {
    const filas = porAnio[anio].map(f => ({
      'Año':                anio,
      'Municipio':          f.municipio,
      'Departamento':       f.departamento,
      'Institución':        f.nombre,
      'Código DANE':        f.cod_dane,
      'Categoría':          f.clasificacion,
      'Sector':             f.sector,
      'Puesto Municipal':   f.ranking_municipio,
      'Puesto Depto':       f.ranking_departamento,
      'Puesto Nacional':    f.ranking_nacional,
      'Índice Total':       pfNum(f.indice_total),
      'Lectura Crítica':    pfNum(f.lect),
      'Matemática':         pfNum(f.mate),
      'Sociales':           pfNum(f.soc),
      'Ciencias Naturales': pfNum(f.cien),
      'Inglés':             pfNum(f.ing),
    }));

    // Encabezado institucional
    const ws = XLSX.utils.aoa_to_sheet([
      ['GRUPO EDÚCATE COLOMBIA — Histórico Saber 11'],
      [`Municipio: ${estado.colegioBase.municipio} | Colegio base: ${estado.colegioBase.nombre} | DANE: ${estado.colegioBase.cod_dane}`],
      [`Año: ${anio}`],
      [],
    ]);
    XLSX.utils.sheet_add_json(ws, filas, { origin: 'A5' });
    estilarHoja(ws, filas.length);

    XLSX.utils.book_append_sheet(wb, ws, `${anio}`);
  });

  const mpio = (estado.colegioBase.municipio || 'municipio').replace(/\s+/g,'_');
  XLSX.writeFile(wb, `Historico_${mpio}_DANE_${estado.colegioBase.cod_dane}.xlsx`);
  showToast('✓ Reporte Excel generado', 'ok');
}

// ─── UTILIDADES ───────────────────────────────────────────────
function pf(v)    { return v !== undefined && v !== null && v !== '' ? parseFloat(v).toFixed(4) : '—'; }
function pfH(v)   { return v === 'N/A' || v === null || v === undefined ? 'N/A' : parseFloat(v).toFixed(4); }
function pfNum(v) { return v === 'N/A' || v === null ? 0 : parseFloat(v) || 0; }
function escapar(s) { return (s||'').replace(/'/g, "\\'"); }

async function obtenerCache(anio) {
  if (estado.cache[anio]) return estado.cache[anio];
  const r = await fetch(`${CONFIG.rutaData}${anio}.json`);
  if (!r.ok) return [];
  const d = await r.json();
  estado.cache[anio] = d;
  return d;
}

function estilarHoja(ws, nFilas) {
  // Ancho de columnas
  ws['!cols'] = [
    {wch:6},{wch:26},{wch:18},{wch:14},{wch:16},{wch:12},{wch:10},
    {wch:10},{wch:10},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:10}
  ];
}

function mostrarCargando(v) {
  dom.estadoCargando().classList.toggle('visible', v);
  dom.estadoVacio().classList.toggle('visible', false);
}
function mostrarCargandoH(v) {
  dom.estadoCargandoH() && dom.estadoCargandoH().classList.toggle('visible', v);
}
function mostrarEstado(tipo, v) {
  const el = tipo === 'vacio' ? dom.estadoVacio() : dom.estadoCargando();
  el && el.classList.toggle('visible', v);
}

function abrirModal(id) { $(id).classList.add('active'); }
function cerrarModal(id) { $(id).classList.remove('active'); }
window.cerrarModal = cerrarModal;

let toastTimer = null;
function showToast(msg, tipo = '') {
  const t = $('toast');
  t.textContent = msg;
  t.className   = 'show' + (tipo ? ` toast--${tipo}` : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3200);
}

// ─── DATOS DEMO (fallback sin servidor) ──────────────────────
function generarDatosDemo(anio) {
  const demo = [
    { cod_dane:'311001065489', nombre:'LICEO CAMPO DAVID',       municipio:'BOGOTÁ D.C.', departamento:'BOGOTÁ', clasificacion:'A+', sector:'NO OFICIAL', ranking_nacional:1,  ranking_departamento:1,  ranking_municipio:1,  evaluados_3anios:'102', indice_total:0.9174, 'indice de Matemática':'0.9329','indice de Ciencias Naturales':'0.9180','indice de Sociales y Ciudadanas':'0.9008','indice de Lectura Crítica':'0.9140','indice de Inglés':'0.9294', anio },
    { cod_dane:'311001065490', nombre:'COLEGIO SAN BARTOLOMÉ',   municipio:'BOGOTÁ D.C.', departamento:'BOGOTÁ', clasificacion:'A+', sector:'NO OFICIAL', ranking_nacional:2,  ranking_departamento:2,  ranking_municipio:2,  evaluados_3anios:'98',  indice_total:0.9050, 'indice de Matemática':'0.9100','indice de Ciencias Naturales':'0.9000','indice de Sociales y Ciudadanas':'0.8900','indice de Lectura Crítica':'0.9000','indice de Inglés':'0.9200', anio },
    { cod_dane:'311001065491', nombre:'GYM COLOMBO BRITÁNICO',   municipio:'BOGOTÁ D.C.', departamento:'BOGOTÁ', clasificacion:'A+', sector:'NO OFICIAL', ranking_nacional:3,  ranking_departamento:3,  ranking_municipio:3,  evaluados_3anios:'150', indice_total:0.8980, 'indice de Matemática':'0.9000','indice de Ciencias Naturales':'0.8950','indice de Sociales y Ciudadanas':'0.8800','indice de Lectura Crítica':'0.8900','indice de Inglés':'0.9100', anio },
    { cod_dane:'311001065492', nombre:'I.E. SANTA MARTA NORTE',  municipio:'SANTA MARTA', departamento:'MAGDALENA', clasificacion:'B',  sector:'OFICIAL',     ranking_nacional:45, ranking_departamento:5,  ranking_municipio:1,  evaluados_3anios:'85',  indice_total:0.8200, 'indice de Matemática':'0.8100','indice de Ciencias Naturales':'0.8300','indice de Sociales y Ciudadanas':'0.8000','indice de Lectura Crítica':'0.8100','indice de Inglés':'0.8400', anio },
    { cod_dane:'311001065493', nombre:'COLEGIO SAN LUCAS CENTRAL',municipio:'SAN LUCAS',  departamento:'BOLÍVAR',  clasificacion:'A+', sector:'OFICIAL',     ranking_nacional:8,  ranking_departamento:1,  ranking_municipio:1,  evaluados_3anios:'60',  indice_total:0.9174, 'indice de Matemática':'0.9000','indice de Ciencias Naturales':'0.8900','indice de Sociales y Ciudadanas':'0.8800','indice de Lectura Crítica':'0.9100','indice de Inglés':'0.8700', anio },
    { cod_dane:'311001065494', nombre:'I.E. SAN LUCAS CAMPESTRE', municipio:'SAN LUCAS',  departamento:'BOLÍVAR',  clasificacion:'A',  sector:'OFICIAL',     ranking_nacional:15, ranking_departamento:3,  ranking_municipio:2,  evaluados_3anios:'55',  indice_total:0.8832, 'indice de Matemática':'0.8700','indice de Ciencias Naturales':'0.8600','indice de Sociales y Ciudadanas':'0.8500','indice de Lectura Crítica':'0.8800','indice de Inglés':'0.8400', anio },
  ];
  return demo;
}
