// subscriber.js - Monitor con alertas
// Autor: Ariadna Vanessa Coyla Hancco - Grupo 2
// Recibe las lecturas del sensor, publica una alerta si temp > UMBRAL_TEMP
// y muestra el estado online/offline del sensor.
const fs = require('fs');
const mqtt = require('mqtt');
const cfg = require('./config');

const base = `tecsup/${cfg.grupo}`;
const UMBRAL_TEMP = 30; // °C
const ARCHIVO_CSV = 'lecturas.csv'; // RETO OPCIONAL - Registro de datos

const client = mqtt.connect(cfg.url, {
  username: cfg.username,
  password: cfg.password,
  clientId: `monitor-${cfg.grupo}-${Math.random().toString(16).slice(2, 8)}`,
});

// RETO OPCIONAL - Registro de datos: crea el CSV con encabezado si no existe
if (!fs.existsSync(ARCHIVO_CSV)) {
  fs.writeFileSync(ARCHIVO_CSV, 'ts,id,autor,temp,hum\n');
}

let ventilador = null; // RETO OPCIONAL - Actuador remoto: último estado enviado

client.on('connect', () => {
  console.log(`Monitor de ${cfg.autor} (${cfg.grupo}) conectado al broker`);
  // "#" es un comodín: recibe todo lo que cuelgue de sensores/
  client.subscribe([`${base}/sensores/#`, `${base}/estado`], { qos: 1 }, (err) => {
    if (err) console.error('Error al suscribirse:', err.message);
  });
});

client.on('message', (topic, message) => {
  const texto = message.toString();

  if (topic === `${base}/estado`) {
    console.log(`[ESTADO] Sensor ${texto}`);
    return;
  }

  try {
    const dato = JSON.parse(texto);
    console.log(`[${topic}] temp=${dato.temp} °C, hum=${dato.hum} % (autor: ${dato.autor})`);

    if (dato.temp > UMBRAL_TEMP) {
      const alerta = { id: dato.id, autor: cfg.autor, msg: 'Temperatura alta', temp: dato.temp };
      client.publish(`${base}/alertas`, JSON.stringify(alerta), { qos: 1 });
      console.log('ALERTA enviada:', alerta);
    }

    // RETO OPCIONAL - Registro de datos: guarda cada lectura en el CSV
    fs.appendFileSync(ARCHIVO_CSV, `${dato.ts},${dato.id},${dato.autor},${dato.temp},${dato.hum}\n`);

    // RETO OPCIONAL - Actuador remoto: ON si supera el umbral, OFF si no.
    // Solo publica cuando el estado cambia, para no repetir órdenes.
    const orden = dato.temp > UMBRAL_TEMP ? 'ON' : 'OFF';
    if (orden !== ventilador) {
      ventilador = orden;
      client.publish(`${base}/actuadores/ventilador`, orden, { qos: 1, retain: true });
      console.log(`Ventilador -> ${orden}`);
    }
  } catch (e) {
    console.error('Mensaje con formato no válido:', texto);
  }
});

client.on('error', (err) => console.error('Error:', err.message));
