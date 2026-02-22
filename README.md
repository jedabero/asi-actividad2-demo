# Actividad 2 - Demo del Estilo Arquitectónico Broker

Este repositorio es un demo del estilo arquitectónico **Broker**, implementado con microservicios en `Bun`, RabbitMQ como broker de mensajería y una UI en `Next.js`.

## Objetivo

Simular un flujo de telemetría y procesamiento asíncrono:

1. `sensor` publica lecturas de temperatura/humedad.
2. `data-ingestor` consume y persiste lecturas en SQLite.
3. `report-worker` consume jobs de reporte, calcula agregados y guarda resultados.
4. `auditor` escucha eventos de auditoría y los persiste.
5. `report-web` expone la interfaz web (actualmente plantilla base de Next.js).

## Arquitectura (alto nivel)

```
sensor -> queue telemetry.readings -> data-ingestor -> telemetry.db
                           \-> events.audit (topic) -> auditor -> audit.db

report-web -> queue jobs.report.request -> report-worker -> telemetry.db (jobs/results)
                                       \-> events.audit (topic) -> auditor
```

## Estructura del repositorio

```text
services/
  sensor/
  data-ingestor/
  report-worker/
  auditor/
  report-web/
docker-compose.yml
README.md
```

## Requisitos

- Docker + Docker Compose
- Bun

## Ejecutar con Docker Compose

1. Construir y levantar:

```bash
docker compose up --build
```

2. Acceder a:

- RabbitMQ UI: `http://localhost:15672` (`guest/guest`)
- Web: `http://localhost:3000`

3. Detener:

```bash
docker compose down
```

4. Limpiar volúmenes (opcional):

```bash
docker compose down -v
```

## Variables de entorno principales

### Sensor

- `RABBIT_URL` (default `amqp://guest:guest@localhost:5672`)
- `SENSOR_ID` (default `sensor-1`)
- `INTERVAL_MS` (default `1000`)

### Data ingestor

- `RABBIT_URL`
- `TELEMETRY_DB_PATH` (default `./telemetry.db`)

### Report worker

- `RABBIT_URL`
- `TELEMETRY_DB_PATH` (default `./telemetry.db`)
- `MAX_ATTEMPTS` (default `3`)

### Auditor

- `RABBIT_URL`
- `AUDIT_DB_PATH` (default `./audit.db`)

### Report web

- `RABBIT_URL`
- `WEB_DB_PATH`
- `PORT` (default `3000`)
- `NODE_ENV`

## Colas / exchange usados

- Queue: `telemetry.readings`
- Queue: `jobs.report.request`
- Queue: `jobs.dlq`
- Queue: `audit.events`
- Exchange topic: `events.audit`

## Ejecutar servicios individualmente (sin Docker)

Ejemplo general por servicio:

```bash
cd services/<servicio>
bun install
bun run src/index.ts
```

Para `report-web`:

```bash
cd services/report-web
bun install
bun run dev
```

## Persistencia

Con `docker-compose` se crean volúmenes:

- `telemetry_data` (telemetría + jobs/resultados)
- `web_data`
- `audit_data`

## Estado actual / notas importantes

- `report-web` sigue con la página por defecto de Next.js; la integración UI <-> jobs aún no está implementada en este repositorio.
- En `docker-compose.yml` hay rutas de build con nombres que no existen actualmente:
  - `./services/ingestor` debería ser `./services/data-ingestor`
  - `./services/audit` debería ser `./services/auditor`

Si no se corrigen esas rutas, `docker compose up --build` fallará al construir esos servicios.
