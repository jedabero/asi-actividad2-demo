# Actividad 2 - Demo del Estilo Arquitectónico Broker

Este repositorio es un demo del estilo arquitectónico **Broker**, implementado con microservicios en `Bun`, RabbitMQ como broker de mensajería y una UI en `Next.js`.

## Objetivo

Simular un flujo de telemetría y procesamiento asíncrono:

1. `sensor` publica lecturas de temperatura/humedad.
2. `data-ingestor` consume y persiste lecturas en SQLite.
3. `report-worker` consume jobs de reporte, calcula agregados y guarda resultados.
4. `auditor` escucha eventos de auditoría y los persiste.
5. `report-web-worker` actúa como helper de la web y actualiza `web.db`.
6. `report-web` expone la interfaz web.

## Arquitectura (alto nivel)

```
sensor -> queue telemetry.readings -> data-ingestor -> telemetry.db
                           \-> events.audit (topic) -> auditor -> audit.db

report-web -> queue jobs.report.request -> report-worker -> telemetry.db (jobs/results)
                                       \-> events.audit (topic) -> auditor

broker -> report-web-worker -> web.db -> report-web
```

## Estructura del repositorio

```text
services/
  sensor/
  data-ingestor/
  report-worker/
  report-web-worker/
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

### Report web worker

- `RABBIT_URL`
- `WEB_DB_PATH` (default `./web.db`)

## Colas / exchange usados

- Queue: `telemetry.readings`
- Queue: `jobs.report.request`
- Queue: `jobs.dlq`
- Queue: `audit.events`
- Queue: `report-web.events`
- Exchange topic: `events.audit`

## Comandos para validar después de haber iniciado los servicios

```sh
docker compose logs -f sensor ingestor auditor
```

```sh
docker exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
```

```sh
docker compose exec -T ingestor bun -e "import { Database } from 'bun:sqlite'; const db=new Database('/data/telemetry.db'); console.log(db.query('select count(*) as c from telemetry_readings').get());"
```

```sh
docker compose exec -T auditor bun -e "import { Database } from 'bun:sqlite'; const db=new Database('/data/audit.db'); console.log(db.query('select count(*) as c from audit_events').get());"
```

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
- `web_data` (compartido por `report-web` y `report-web-worker`)
- `audit_data`

## Diagrama

```mermaid
C4Container
title Diagrama de contenedores para Sistema de Telemetría

Person(user, Usuario, "Usuario del sistema, solicita y ve reportes")

Container_Boundary(c1, "Sistema de Telemetría") {
  Container(broker, "RabbitMQ Broker", "RabbitMQ", "Broker de mensajería AMQP")
  Container(sensor, "Sensor", "TypeScript (Bun)", "Publica lecturas de telemetría cada segundo")
  Container(report_worker, "Report Worker", "TypeScript (Bun)", "Procesa jobs y calcula reportes agregados")

  Container_Boundary(c_ingest, "Ingesta y Telemetría") {
    Container(ingestor, "Data Ingestor", "TypeScript (Bun)", "Consume telemetría y persiste lecturas")
    ContainerDb(telemetry_db, "Telemetry DB", "SQLite", "Lecturas + jobs + resultados de reportes")
  }

  Container_Boundary(c_audit, "Auditoría") {
    Container(auditor, "Auditor", "TypeScript (Bun)", "Consume eventos de auditoría para observabilidad")
    ContainerDb(audit_db, "Audit DB", "SQLite", "Eventos de auditoría")
  }

  Container_Boundary(c_web, "Capa Web") {
    Container(web, "Report Web", "Next.js", "UI para solicitar y consultar reportes")
    Container(web_worker, "Report Web Worker", "TypeScript (Bun)", "Helper que consume eventos y actualiza web.db")
    ContainerDb(web_db, "Web DB", "SQLite", "Datos locales del servicio web")
  }
}

Rel(user, web, "Usa", "HTTP")
Rel(web, broker, "Publica jobs", "AMQP queue: jobs.report.request")
Rel(sensor, broker, "Publica lecturas", "AMQP queue: telemetry.readings")
Rel(ingestor, broker, "Consume lecturas", "AMQP queue: telemetry.readings")
Rel(report_worker, broker, "Consume jobs", "AMQP queue: jobs.report.request")
Rel(report_worker, broker, "Reintentos/errores", "AMQP queue: jobs.dlq")
Rel(web_worker, broker, "Consume eventos/resultados", "AMQP")

Rel(sensor, broker, "Publica eventos", "AMQP topic: events.audit")
Rel(ingestor, broker, "Publica eventos", "AMQP topic: events.audit")
Rel(report_worker, broker, "Publica eventos", "AMQP topic: events.audit")
Rel(auditor, broker, "Consume eventos", "AMQP queue: audit.events <- events.audit/#")

Rel(ingestor, telemetry_db, "Inserta lecturas", "SQLite")
Rel(report_worker, telemetry_db, "Lee lecturas y guarda resultados", "SQLite")
Rel(auditor, audit_db, "Persiste eventos", "SQLite")
Rel(web, web_db, "Usa almacenamiento local", "SQLite")
Rel(web_worker, web_db, "Actualiza estado/resultados para la UI", "SQLite")
```
