# Roadmap de producto — Pawtect Modelo A

## Principio de diseño

Pawtect protege estudiantes. El producto admite reportes estudiantiles sobre presuntos agresores estudiantes o adultos, pero no admite denuncias laborales de docentes contra docentes. Los casos que involucren adultos requieren ruta independiente y derivación competente.

## Qué incorpora este paquete

- Protocolo para reportes ocurridos dentro y fuera del colegio.
- Ruta independiente cuando el reporte señale a docentes, directivos o personal.
- Procedimiento de triage, documentación, derivación y seguimiento.
- Guía de imparcialidad para evitar etiquetar a alguien como agresor o víctima sin verificación.
- Reglas para evidencias, privacidad, permisos y auditoría.
- Charlas mensuales y métricas preventivas.
- WhatsApp solo para difusión moderada, nunca para expedientes.
- Requisitos operativos antes de habilitar una línea telefónica especial.
- FAQ para estudiantes, familias, docentes y colegios.

## Qué no se activa todavía

- No crear una línea telefónica ni prometer atención 24/7 sin personal, presupuesto y protocolo.
- No presentar WhatsApp como canal seguro de denuncias.
- No anunciar anonimato pleno: la versión actual usa cuentas de estudiante.
- No añadir investigación automatizada, puntuaciones de credibilidad o detección de mentiras por IA.
- No automatizar sanciones ni decisiones de culpabilidad.
- No eliminar la ruta independiente existente para reportes estudiantiles contra docentes/directivos.
- No cambiar esquema SQL, secretos, proveedores ni despliegue en esta fase documental.

## Auditoría técnica previa a cambios de aplicación

La rama revisada ya contiene selector de a quién involucra el reporte, ruta independiente para reportes contra docentes/directivos, equipo Pawtect independiente, notas internas, eventos de seguimiento, permisos por ruta y colegio, prioridad urgente y controles de archivos.

Antes de implementar nuevas funciones, probar y revisar:
1. que la ruta independiente no sea visible para personal del colegio señalado;
2. que un reporte contra director se derive a UGEL conforme al protocolo;
3. que los casos con persona externa no terminen automáticamente en una bandeja inadecuada;
4. que el formulario permita indicar lugar y fecha del hecho;
5. que las pantallas expliquen la diferencia entre confidencialidad y anonimato;
6. que el rol técnico no tenga acceso rutinario a relatos y evidencias;
7. que los estados no sugieran que Pawtect declaró culpabilidad;
8. que la urgencia tenga un mensaje de seguridad visible y no prometa guardia permanente.

## Siguiente fase

### P0 — Seguridad y cumplimiento
- revisar permisos y aislamiento de expedientes;
- validar auditoría de accesos y descargas;
- definir conservación, eliminación y respuesta a incidentes;
- revisión legal y acuerdos institucionales.

### P1 — Formulario y flujo
- añadir lugar, fecha aproximada y relación entre involucrados;
- incorporar guía de atención para hechos externos;
- mejorar ruta independiente y derivación;
- crear un buzón bidireccional de seguimiento reservado.

### P2 — Prevención
- calendario de charlas;
- página de recursos para estudiantes y familias;
- panel de métricas agregadas;
- avisos moderados de actividades.

### P3 — Línea de ayuda
- solo tras definir entidad responsable, horarios, personal, supervisión, escalamiento y presupuesto.

## Criterios de aceptación

- Un estudiante puede reportar un hecho fuera del colegio.
- Un reporte contra docente/directivo no llega a la bandeja del plantel denunciado.
- Un docente no puede abrir un reporte de otro docente como denunciante.
- Ninguna pantalla declara culpabilidad.
- No se publican nombres ni evidencias en WhatsApp o foros.
- La aplicación no promete anonimato o atención 24/7 que no estén implementados.
- Las derivaciones y accesos quedan registrados.
