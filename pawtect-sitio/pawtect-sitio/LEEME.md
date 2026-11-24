# PAWTECT · Plataforma escolar

La entrada principal está en public/index.html. Desde allí puedes pedir ayuda, acceder al foro, consultar casos o entrar a la colección interactiva de accesorios.

## Probar en tu computadora

En Windows abre VER_DEMO.cmd con Python 3 instalado. Visita http://127.0.0.1:8765/demo/index.html. Los formularios de esta ruta usan la base SQLite de práctica en tu pestaña. Cambia de rol para probar el envío, la recepción y el seguimiento con datos ficticios.

## Publicar en Vercel con Neon

La raíz del proyecto contiene package.json, api/, server/, public/, sql/ y vercel.json. La guía GUIA.md describe las variables de entorno, el padrón institucional y la configuración de cuentas. La conexión a Neon y los servicios de Google y correo se configuran en el servidor. Para una base existente revisa las migraciones ya aplicadas antes de ejecutar SQL.

La colección está en /coleccion/index.html. Su QR incorpora el dominio público indicado en la presentación. Si despliegas bajo otro dominio, actualiza la placa antes de usarla físicamente.
