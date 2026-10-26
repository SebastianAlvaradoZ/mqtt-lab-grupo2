// publisher.js - Sensor ambiental simulado
// Autor: Ariadna Vanessa Coyla Hancco - Grupo 2
// Publica temperatura y humedad cada 2 s en tecsup/<grupo>/sensores/ambiente
// y su estado (online/offline) en tecsup/<grupo>/estado (retenido + LWT).
const mqtt = require('mqtt');
const cfg = require('./config');

const base = `tecsup/${cfg.grupo}`;

const client = mqtt.connect(cfg.url, {
  username: cfg.username,
  password: cfg.password,
  clientId: `sensor-${cfg.grupo}-${Math.random().toString(16).slice(2, 8)}`,
  // Última voluntad: si el sensor se cae, el broker avisa "offline"
  will: { topic: `${base}/estado`, payload: 'offline', qos: 1, retain: true },
});

client.on('connect', () => {
  console.log(`Sensor de ${cfg.autor} (${cfg.grupo}) conectado al broker`);
  client.publish(`${base}/estado`, 'online', { qos: 1, retain: true });

  // RETO OPCIONAL - Actuador remoto: el sensor escucha la orden del ventilador
  client.subscribe(`${base}/actuadores/ventilador`, { qos: 1 });
});

// RETO OPCIONAL - Actuador remoto: muestra el estado del "ventilador"
client.on('message', (topic, message) => {
  if (topic === `${base}/actuadores/ventilador`) {
    console.log(`>> Ventilador: ${message.toString()}`);
  }
});

client.on('error', (err) => console.error('Error:', err.message));

function publicar() {
  const dato = {
    id: 'sensor-01',
    autor: cfg.autor,
    temp: +(20 + Math.random() * 15).toFixed(1), // 20.0 a 35.0 °C
    hum: Math.round(40 + Math.random() * 40), // 40 a 80 %
    ts: new Date().toISOString(),
  };
  client.publish(`${base}/sensores/ambiente`, JSON.stringify(dato), { qos: 1 });
  console.log('Publicado:', dato);
}

// Publica una lectura cada 2 segundos (solo si hay conexión)
setInterval(() => { if (client.connected) publicar(); }, 2000);
