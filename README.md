# Laboratorio 11 – Servidor MQTT (Mosquitto) en Debian 12 – Cliente en Node.js

**Grupo 2** – Tecnologías Emergentes, Tecsup 2026-I

Integrantes:
- Vanessa Coyla
- Sebastian Alvarado
- Alim Urure
- Adriano Monroy
- Patrick Vizcarra

Sensor ambiental simulado (`publisher.js`), monitor con alertas (`subscriber.js`) y panel web
(`panel.js`) que se comunican con un broker Mosquitto propio con autenticación.

## Tópicos

| Tópico | Publica | Contenido |
|---|---|---|
| `tecsup/<grupo>/sensores/ambiente` | Sensor | JSON `{id, autor, temp, hum, ts}` – QoS 1 |
| `tecsup/<grupo>/estado` | Sensor / broker (LWT) | `online` / `offline` – retenido |
| `tecsup/<grupo>/alertas` | Monitor | JSON `{id, autor, msg, temp}` cuando temp > 30 °C |
| `tecsup/<grupo>/actuadores/ventilador` | Monitor (reto) | `ON` / `OFF` – retenido |

## Instalación

```bash
npm install
```

Crea el archivo `config.js` (no se incluye en la entrega porque contiene credenciales),
tal como indica la guía:

```js
module.exports = {
  url: 'mqtt://<tu_ip_publica>:1883',
  username: 'iotuser',
  password: '<clave_mqtt>',
  grupo: 'grupo2',
  autor: '<tu nombre>',
  // Opcional (reto ACL): usuario de solo lectura que usará el panel web
  // lector: { username: 'lector', password: '<clave_lector>' },
};
```

## Ejecución

| Programa | Comando | Alternativa |
|---|---|---|
| Monitor | `node subscriber.js` | `npm run monitor` |
| Sensor | `node publisher.js` | `npm run sensor` |
| Panel web | `node panel.js` y abrir http://localhost:3000 | `npm run panel` |

- **Última voluntad (LWT):** detén el sensor con Ctrl+C; el monitor muestra `[ESTADO] Sensor offline`.
- **Mensaje retenido:** con el sensor detenido, reinicia el monitor; recibe `offline` de inmediato.

## Retos opcionales implementados

1. **Actuador remoto:** el monitor publica `ON`/`OFF` en `tecsup/grupo2/actuadores/ventilador`
   según la temperatura (solo cuando cambia) y el sensor muestra `>> Ventilador: ON/OFF`.
2. **Registro de datos:** el monitor guarda cada lectura en `lecturas.csv` (`ts,id,autor,temp,hum`).
3. **Panel web:** `panel.js` muestra en tiempo real la temperatura, la humedad, el estado del
   sensor, el ventilador, un gráfico y las alertas (Server-Sent Events, sin librerías extra).
4. **Seguridad con ACL:** en el servidor se creó el usuario MQTT `lector` con permiso de solo
   lectura. Archivo `/etc/mosquitto/acl` (activado con `acl_file /etc/mosquitto/acl`):

   ```
   user iotuser
   topic readwrite tecsup/#

   user lector
   topic read tecsup/grupo2/#
   ```

   Prueba: `mosquitto_pub -V mqttv5 -q 1 ... -u lector` responde `Not authorized`.

> `config.js` contiene credenciales y no se incluye en la entrega (está en `.gitignore`).
