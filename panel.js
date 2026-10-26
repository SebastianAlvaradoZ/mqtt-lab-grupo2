// panel.js - Panel web en tiempo real (RETO OPCIONAL - Panel web)
// Grupo 2 - Laboratorio 11 MQTT
// Se suscribe a tecsup/<grupo>/# y envía cada mensaje al navegador con
// Server-Sent Events. No necesita librerías extra: usa 'mqtt' y el módulo http de Node.
// Uso: node panel.js   ->  abrir http://localhost:3000
const http = require('http');
const mqtt = require('mqtt');
const cfg = require('./config');

const PUERTO = 3000;
const base = `tecsup/${cfg.grupo}`;
const MAX_HISTORIAL = 60;

// Si config.js tiene un usuario de solo lectura (reto de ACL), el panel lo usa.
const cred = cfg.lector || { username: cfg.username, password: cfg.password };

const estado = {
  sensor: 'desconocido',
  ventilador: '-',
  lecturas: [],   // últimas lecturas recibidas
  alertas: [],    // últimas alertas recibidas
};
const clientesWeb = new Set();

function enviarATodos(evento) {
  const linea = `data: ${JSON.stringify(evento)}\n\n`;
  for (const res of clientesWeb) res.write(linea);
}

const client = mqtt.connect(cfg.url, {
  username: cred.username,
  password: cred.password,
  clientId: `panel-${cfg.grupo}-${Math.random().toString(16).slice(2, 8)}`,
});

client.on('connect', () => {
  console.log(`Panel conectado al broker como ${cred.username}`);
  client.subscribe(`${base}/#`, { qos: 1 }, (err) => {
    if (err) console.error('Error al suscribirse:', err.message);
  });
});

client.on('error', (err) => console.error('Error MQTT:', err.message));

client.on('message', (topic, message) => {
  const texto = message.toString();
  try {
    if (topic === `${base}/estado`) {
      estado.sensor = texto;
      enviarATodos({ tipo: 'estado', valor: texto });
    } else if (topic === `${base}/actuadores/ventilador`) {
      estado.ventilador = texto;
      enviarATodos({ tipo: 'ventilador', valor: texto });
    } else if (topic === `${base}/alertas`) {
      const alerta = { ...JSON.parse(texto), recibido: new Date().toISOString() };
      estado.alertas.push(alerta);
      if (estado.alertas.length > 10) estado.alertas.shift();
      enviarATodos({ tipo: 'alerta', valor: alerta });
    } else if (topic.startsWith(`${base}/sensores/`)) {
      const dato = JSON.parse(texto);
      estado.lecturas.push(dato);
      if (estado.lecturas.length > MAX_HISTORIAL) estado.lecturas.shift();
      enviarATodos({ tipo: 'lectura', valor: dato });
    }
  } catch (e) {
    console.error('Mensaje con formato no válido en', topic, ':', texto);
  }
});

const servidor = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // Al conectarse, el navegador recibe todo lo acumulado hasta ahora
    res.write(`data: ${JSON.stringify({ tipo: 'inicial', valor: estado })}\n\n`);
    clientesWeb.add(res);
    req.on('close', () => clientesWeb.delete(res));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(PAGINA.replace(/__GRUPO__/g, cfg.grupo));
});

servidor.listen(PUERTO, () => {
  console.log(`Panel web en http://localhost:${PUERTO}`);
});

const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel MQTT - __GRUPO__</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  :root { --bg:#f4f6f8; --card:#fff; --txt:#1d2733; --sub:#5b6875; --borde:#dde3e9;
          --ok:#1f8a4c; --mal:#c0392b; --temp:#d9534f; --hum:#2e7dd7; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#12171d; --card:#1b232c; --txt:#e6edf3; --sub:#9aa7b4; --borde:#2b3640; }
  }
  * { box-sizing:border-box; }
  body { margin:0; font-family:system-ui,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--txt); }
  header { padding:20px 24px 8px; }
  h1 { margin:0; font-size:22px; }
  header p { margin:4px 0 0; color:var(--sub); font-size:14px; }
  main { padding:16px 24px 32px; display:grid; gap:16px; grid-template-columns:repeat(4,1fr); }
  .card { background:var(--card); border:1px solid var(--borde); border-radius:10px; padding:16px; }
  .card h2 { margin:0 0 8px; font-size:13px; font-weight:600; color:var(--sub); text-transform:uppercase; letter-spacing:.04em; }
  .valor { font-size:30px; font-weight:700; }
  .peq { font-size:13px; color:var(--sub); margin-top:4px; }
  .ok { color:var(--ok); } .mal { color:var(--mal); }
  .ancho { grid-column:1 / -1; }
  .mitad { grid-column:span 2; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:6px 8px; border-bottom:1px solid var(--borde); }
  th { color:var(--sub); font-weight:600; }
  .vacio { color:var(--sub); font-size:14px; }
  #conexion { font-size:13px; }
  @media (max-width: 800px) { main { grid-template-columns:1fr 1fr; } .mitad { grid-column:1 / -1; } }
</style>
</head>
<body>
<header>
  <h1>Panel en tiempo real · tecsup/__GRUPO__</h1>
  <p>Laboratorio 11 – Servidor MQTT (Mosquitto) · <span id="conexion">conectando…</span></p>
</header>
<main>
  <div class="card"><h2>Temperatura</h2><div class="valor" id="temp">–</div><div class="peq" id="autor">sin lecturas</div></div>
  <div class="card"><h2>Humedad</h2><div class="valor" id="hum">–</div><div class="peq" id="hora">&nbsp;</div></div>
  <div class="card"><h2>Estado del sensor</h2><div class="valor" id="estado">–</div><div class="peq">retenido + última voluntad</div></div>
  <div class="card"><h2>Ventilador</h2><div class="valor" id="vent">–</div><div class="peq">actuadores/ventilador</div></div>
  <div class="card ancho"><h2>Últimas lecturas</h2><canvas id="grafico" height="90"></canvas></div>
  <div class="card mitad"><h2>Alertas (temp &gt; 30 °C)</h2><div id="alertas" class="vacio">Sin alertas todavía.</div></div>
  <div class="card mitad"><h2>Lecturas recientes</h2><div id="tabla" class="vacio">Esperando datos del sensor…</div></div>
</main>
<script>
const css = getComputedStyle(document.documentElement);
const grafico = new Chart(document.getElementById('grafico'), {
  type: 'line',
  data: { labels: [], datasets: [
    { label: 'Temperatura (°C)', data: [], borderColor: css.getPropertyValue('--temp'), yAxisID: 'yT', tension: .3, pointRadius: 2 },
    { label: 'Humedad (%)', data: [], borderColor: css.getPropertyValue('--hum'), yAxisID: 'yH', tension: .3, pointRadius: 2 },
  ]},
  options: { animation: false, interaction: { mode: 'index', intersect: false },
    scales: { yT: { position: 'left', title: { display: true, text: '°C' }, suggestedMin: 18, suggestedMax: 36 },
              yH: { position: 'right', title: { display: true, text: '%' }, min: 0, max: 100, grid: { drawOnChartArea: false } } } }
});
let lecturas = [];
const hora = (ts) => new Date(ts).toLocaleTimeString();
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]));

function pintarLectura(d) {
  document.getElementById('temp').textContent = d.temp + ' °C';
  document.getElementById('temp').className = 'valor ' + (d.temp > 30 ? 'mal' : '');
  document.getElementById('hum').textContent = d.hum + ' %';
  document.getElementById('autor').textContent = 'autor: ' + (d.autor || d.id);
  document.getElementById('hora').textContent = hora(d.ts);
}
function agregarLectura(d, redibujar = true) {
  lecturas.push(d); if (lecturas.length > 60) lecturas.shift();
  grafico.data.labels = lecturas.map((x) => hora(x.ts));
  grafico.data.datasets[0].data = lecturas.map((x) => x.temp);
  grafico.data.datasets[1].data = lecturas.map((x) => x.hum);
  if (redibujar) { grafico.update(); pintarLectura(d); pintarTabla(); }
}
function pintarTabla() {
  const ult = lecturas.slice(-8).reverse();
  document.getElementById('tabla').innerHTML = ult.length ? '<table><tr><th>Hora</th><th>Autor</th><th>Temp</th><th>Hum</th></tr>' +
    ult.map((x) => '<tr><td>' + hora(x.ts) + '</td><td>' + esc(x.autor || x.id) + '</td><td>' + x.temp + ' °C</td><td>' + x.hum + ' %</td></tr>').join('') + '</table>'
    : 'Esperando datos del sensor…';
  document.getElementById('tabla').className = ult.length ? '' : 'vacio';
}
let alertas = [];
function pintarAlertas() {
  const el = document.getElementById('alertas');
  el.className = alertas.length ? '' : 'vacio';
  el.innerHTML = alertas.length ? '<table><tr><th>Hora</th><th>Autor</th><th>Mensaje</th><th>Temp</th></tr>' +
    alertas.slice().reverse().map((a) => '<tr><td>' + hora(a.recibido) + '</td><td>' + esc(a.autor || a.id) + '</td><td class="mal">' + esc(a.msg) + '</td><td>' + a.temp + ' °C</td></tr>').join('') + '</table>'
    : 'Sin alertas todavía.';
}
function pintarEstado(v) { const e = document.getElementById('estado'); e.textContent = v; e.className = 'valor ' + (v === 'online' ? 'ok' : v === 'offline' ? 'mal' : ''); }
function pintarVent(v) { const e = document.getElementById('vent'); e.textContent = v; e.className = 'valor ' + (v === 'ON' ? 'mal' : v === 'OFF' ? 'ok' : ''); }

const fuente = new EventSource('/events');
fuente.onopen = () => { document.getElementById('conexion').textContent = 'conectado'; };
fuente.onerror = () => { document.getElementById('conexion').textContent = 'sin conexión con el panel (¿se detuvo node panel.js?)'; };
fuente.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.tipo === 'inicial') {
    lecturas = []; m.valor.lecturas.forEach((d) => agregarLectura(d, false)); grafico.update();
    if (lecturas.length) pintarLectura(lecturas[lecturas.length - 1]);
    pintarTabla(); alertas = m.valor.alertas; pintarAlertas();
    pintarEstado(m.valor.sensor); pintarVent(m.valor.ventilador);
  } else if (m.tipo === 'lectura') agregarLectura(m.valor);
  else if (m.tipo === 'alerta') { alertas.push(m.valor); if (alertas.length > 10) alertas.shift(); pintarAlertas(); }
  else if (m.tipo === 'estado') pintarEstado(m.valor);
  else if (m.tipo === 'ventilador') pintarVent(m.valor);
};
</script>
</body>
</html>`;
