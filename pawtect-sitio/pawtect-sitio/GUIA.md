# Pawtect · Del proyecto universitario al piloto

## Presentar la demostración

Abre **Demo** en la cabecera o **Explorar la demo** en el pie. La práctica contiene una base SQLite dentro del navegador. Los cambios y adjuntos de prueba quedan en esa pestaña. **Cambiar rol** te permite recorrer Estudiante, Convivencia escolar, Psicología, Equipo Pawtect y Administración. **Reiniciar** restaura los ejemplos. **Salir de la demo** borra la práctica. Utiliza nombres y archivos ficticios.


1. Como estudiante, entra a **Pedir ayuda**, elige a quién involucra el caso y adjunta un JPG, PNG o PDF ficticio. Pulsa **Revisar mi mensaje**. Comprueba el destinatario, la urgencia y los permisos. Puedes volver a editar antes de confirmar. Guarda el código PT que aparece al enviarlo.
2. Cambia a Convivencia escolar y localiza un caso entre estudiantes. Toma el caso, ajusta su prioridad y escribe un mensaje para el estudiante. Añade también una nota interna. Vuelve al rol Estudiante y abre **Mis casos → Último mensaje** para comprobar qué respuesta puede leer. La copia de informe se puede imprimir, guardar como PDF o descargar en texto.
3. Envía otro caso ficticio que señale a un docente. Cambia a Equipo Pawtect para atenderlo. Comprueba que el plantel no lo ve. Las conversaciones de psicología tienen su propia bandeja.
4. Publica una experiencia en el foro. Desde los tres puntos puedes reportarla y luego revisarla con el perfil Convivencia. La revisión humana permite aprobar, retirar, advertir, pausar 24 horas o 7 días, o expulsar por una infracción grave.
5. En **Para colegios** solicita el piloto con datos ficticios. En la administración revisa esa solicitud y prueba generar una cuenta del dominio de muestra. La clave inicial se muestra una vez. Puedes renovarla mientras la cuenta siga pendiente de su primer cambio. La solicitud de certificación entrega un código y una clave de consulta. Al aprobarla, el colegio puede imprimir o guardar en PDF su certificado desde Para colegios.
6. Para compartirlo con tu clase, usa los ajustes de acceso del sitio y selecciona a quienes deban ver la demostración. Para el QR, abre Para colegios en el sitio definitivo y descarga la imagen.

## Activar el sitio entregado en Sites

1. La versión publicada por el equipo tiene su base y almacén de adjuntos propios. Su clave protegida PAWTECT_DATA_KEY ya se configuró. Cambiar esa clave requiere haber migrado las identidades existentes.
2. En las variables del sitio agrega PAWTECT_ADMIN_EMAIL con la dirección exacta de la cuenta propietaria. Despliega la versión con los nuevos valores.
3. Entra con esa cuenta, abre **Mi cuenta → Activar la primera administración** y completa tu DNI, correo y contraseña personal. En Sites deja vacío el código de instalación.
4. Registra el colegio y el dominio de Google Workspace. Crea cuentas específicas para convivencia, psicología y el equipo Pawtect independiente. El colegio solo puede crear estudiantes. Una persona del equipo independiente debe estar adscrita como responsable Pawtect y estar fuera del plantel señalado.
5. Crea una cuenta de estudiante del padrón autorizado, entrega sus credenciales por un canal privado y reúne la autorización que corresponda al piloto. El sistema usa el DNI que registra el colegio. No consulta RENIEC.
6. Si deseas recibir solicitudes reales de colegios nuevos, activa PAWTECT_PILOT_OPEN=1 después de designar quién las revisará. El representante podrá enviar el formulario desde el portal institucional.

## Publicar una copia propia en GitHub, Vercel y Neon

Necesitas tus cuentas de GitHub, Vercel y Neon. En un repositorio que ya está conectado a Vercel, crea una rama para probar la actualización. Si es tu primer despliegue, crea un proyecto nuevo. Las cuentas, reportes y adjuntos de Sites y del anterior ZIP quedan en sus respectivos sistemas.

1. Descomprime este archivo. En Visual Studio Code abre la carpeta que contiene **api**, **public**, **server**, **sql**, **vercel.json** y **package.json**. La portada, el inicio de sesión y el foro están en public/index.html, public/login.html y public/foro.html.
2. En Neon crea un proyecto, una base independiente vacía o una rama con base vacía. En **SQL Editor** pega y ejecuta una sola vez **sql/01_pawtect.sql** completo. Si tu base ya tiene las tablas `members`, `tickets`, `certifications` y `roster`, esta actualización utiliza esa misma estructura. Conserva la clave de datos. En una versión anterior del paquete que aún carezca de `roster`, ejecuta únicamente **sql/02_actualizar_padron.sql**. Si tu proyecto anterior tiene otras tablas, crea una base aparte. En **Connect** copia la cadena PostgreSQL con la contraseña y TLS.
3. En GitHub usa la rama de prueba de tu repositorio o crea un repositorio si partes de cero. Sube el contenido descomprimido conservando las carpetas. El archivo package.json debe quedar en la raíz. No subas credenciales ni archivos .env.
4. En Vercel entra a **Add New → Project**, importa ese repositorio, elige **Other** y deja **Root Directory** en la raíz. La configuración incluida publica public y ejecuta api/pawtect como función de servidor.
5. En **Settings → Environment Variables**, ámbito Production, agrega las variables de la tabla. Para generar cada secreto en tu propia terminal con Node instalado, ejecuta dos veces, una por valor: node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))". Copia cada resultado directamente al gestor de secretos. Conserva una copia segura de la clave de datos.

| Variable | Contenido |
| --- | --- |
| DATABASE_URL | Conexión privada a la base nueva de Neon. |
| PAWTECT_DATA_KEY | Primer secreto aleatorio, permanente. Protege identidades y claves de búsqueda. Mantenerlo permite volver a abrir los registros existentes. |
| PAWTECT_SETUP_TOKEN | Segundo secreto aleatorio para el alta inicial de administración. |
| GOOGLE_CLIENT_ID | ID público del cliente web de Google para el acceso institucional. |
| RESEND_API_KEY | Clave privada de Resend con permiso de envío. |
| EMAIL_FROM | Remitente de un dominio que administras y verificaste en Resend. |
| PAWTECT_PILOT_OPEN | Opcional. El valor 1 habilita solicitudes institucionales externas para el piloto. |

6. Pulsa **Deploy**. Abre el dominio HTTPS asignado. En **Mi cuenta → Activar la primera administración**, coloca el código de instalación, tu DNI, correo y contraseña de al menos 12 caracteres. Tras verificar que puedes iniciar sesión, quita PAWTECT_SETUP_TOKEN de Vercel y vuelve a desplegar. Para cambios futuros en variables usa **Deployments → Redeploy**.
7. En Administración → Colegios registra el nombre y dominio institucional del colegio. En Cuentas genera las cuatro cuentas de prueba como en la guía de Sites. El correo de cada persona debe ser del dominio aprobado. Añade el correo familiar únicamente con autorización. Las claves iniciales se cambian al entrar.
8. Con dos navegadores prueba con dos cuentas ficticias institucionales: muestra del estudiante en uno y del plantel en el otro. Verifica que el foro sea compartido solo dentro del colegio y que cada caso llegue a la bandeja correspondiente. El selector Cuenta demo siempre usa un espacio aislado por navegador.
9. Si usas un dominio propio, conéctalo en Vercel y espera la validación DNS. Registra ese origen definitivo en Google y genera el QR desde Para colegios. Haz un escaneo desde un celular.

## Google institucional

1. Abre [Google Auth Platform](https://console.cloud.google.com/). Configura el nombre Pawtect, tu contacto y la audiencia del proyecto. Si está en modo de pruebas incluye a los usuarios de prueba.
2. Crea una credencial OAuth tipo **Aplicación web**. En **Orígenes autorizados de JavaScript** registra el origen exacto de cada despliegue que usarás, por ejemplo https://tu-proyecto.vercel.app, sin ruta. Este flujo usa el botón Google Identity Services con devolución en el navegador.
3. Configura GOOGLE_CLIENT_ID y vuelve a desplegar. Comprueba que el correo esté precargado en el padrón y que el dominio configurado sea el de Google Workspace del colegio.
4. En **Administración → Cuentas**, selecciona el colegio y pulsa **Importar padrón CSV**. Descarga la plantilla, conserva ocho dígitos por DNI, edita los correos para el dominio del colegio y revisa la vista previa. Importa hasta 50 filas por archivo. Un ejemplo de campos es `dni,nombre,grado,correo`. Estudiantes inscritos pueden usar **Continuar con Google institucional** desde su primer ingreso. Pawtect cruza el correo verificado y el dominio de Google con la ficha escolar. El nombre y grado del padrón se muestran en Mi cuenta. Se incorpora el nombre que devuelve Google al vincular el acceso.
5. Para generar credenciales con clave, escribe el DNI en **Administración → Cuentas**, pulsa **Buscar DNI en el padrón**, revisa la ficha y genera el usuario `DNI@pawtect.com`. Es un identificador de acceso interno. Los avisos llegan a la dirección institucional registrada. La búsqueda de DNI está reservada a responsables autorizados y queda registrada. El personal activa primero su clave y después vincula Google desde Mi cuenta. La demo incluye el DNI inventado **00000042** (Álex Rivera).
6. Prueba con la cuenta institucional y comprueba el rechazo de un Gmail personal.

[Configuración oficial de Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) · [Validación de identidad](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

## Avisos por correo

1. En Resend agrega un dominio que controles y completa la verificación DNS. Crea la clave de envío y configura RESEND_API_KEY y EMAIL_FROM en el alojamiento.
2. Despliega de nuevo. Realiza un caso institucional de prueba con correos autorizados. En la demo los avisos solo aparecen en Pawtect.
3. Revisa el correo institucional destinatario (también recibe en Gmail o Google Workspace) y Administración → Correo. La aplicación envía un aviso genérico. El relato, DNI, clave y evidencias se consultan en el portal. El estado «aceptado» por el proveedor no acredita lectura ni entrega en la bandeja principal.
4. Si el proveedor estuvo sin configurar, usa **Procesar avisos pendientes** en Administración. Comprueba las incidencias de entrega en el panel del proveedor.

[Dominio de envío](https://resend.com/docs/dashboard/domains/introduction) · [Claves de idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Revisión para un piloto con estudiantes reales

Designa los responsables de cada ruta y sus horarios, acuerda el protocolo con la institución y documenta consentimientos, canal de derechos, plazos de conservación, copias de respaldo y recuperación. Valida con el colegio cómo escalar situaciones urgentes y revisa el texto de privacidad con los responsables del tratamiento. La demostración no cuenta con un servicio profesional de guardia. Para reportes oficiales está disponible [SíseVe del Minedu](https://www.gob.pe/62013-siseve).

La propuesta académica del Equipo Gotita Azul contempla un piloto sin costo. Los importes de referencia son S/ 200 mensuales por colegio en Base, S/ 500 en Premium y S/ 29.90 por accesorio opcional. El reconocimiento anual lo otorga Pawtect como proyecto, tras la revisión de los requisitos.

[Vercel y variables de entorno](https://vercel.com/docs/environment-variables/managing-environment-variables) · [Conexión a Neon](https://neon.com/docs/get-started/connect-neon)

## Diseño y herramientas para estudiantes

La navegación por intención toma como referencia YoungMinds. El acceso a unos apuntes de estudio con Salida rápida se inspira en la salida discreta de Childline. El historial puede conservar páginas anteriores. El estado de ánimo seleccionado en Inicio dura solo mientras esa pantalla está abierta. Las guías permiten copiar una frase para pedir ayuda o acompañar a un amigo.

[YoungMinds](https://www.youngminds.org.uk/young-person/) · [Childline](https://www.childline.org.uk/)

## Continuar el proyecto desde GitHub

1. En la carpeta que contiene `package.json`, usa Node 24. Ejecuta `npm ci` y luego `npm run build:practice`. El primer comando instala las versiones fijadas en `package-lock.json`. El segundo reconstruye la demo y las páginas HTML. Incluye esos archivos generados en tu rama.
2. Para editar el formulario y Mis casos, abre `public/ui/cases.js`. Los estilos adaptables están en `public/ui/campus.css`, los permisos y la selección del último mensaje compartido en `server/tickets.js`, y los ejemplos ficticios en `practice/seed.js`.
3. En la vista previa de la rama, prueba las tres rutas con un caso entre estudiantes, otro que señale a personal del colegio y una consulta de psicología. Revisa el destinatario, vuelve a editar y confirma. Desde el rol asignado, envía una respuesta y luego una nota interna. Comprueba que el estudiante solo reciba la respuesta y que otra ruta no pueda abrir el expediente.
4. Cuando la rama esté probada, intégrala en la rama de producción que usa tu proyecto de Vercel. Esta revisión del formulario y del seguimiento funciona con las tablas del paquete que ya incluye el padrón. Para habilitar el acceso institucional y los avisos, completa las secciones de Google y correo de esta guía.

El rediseño recupera el último mensaje de la versión original de Pawtect. Con Impeccable revisamos el formulario en pantalla estrecha y el lenguaje de los controles. La documentación de Claude-Mem sirvió de referencia para mostrar primero el estado del caso y abrir el texto a petición del estudiante. Con la utilidad de Vercel Skills se comprobaron las huellas de los archivos de referencia empleados en la revisión.

[Impeccable](https://github.com/pbakaus/impeccable) · [Claude-Mem](https://github.com/thedotmack/claude-mem) · [Vercel Skills](https://github.com/vercel-labs/skills)

## Actualización de alcance — Pawtect Modelo A

Pawtect es una plataforma enfocada en la protección estudiantil. Permite recibir reportes de situaciones de violencia que afectan a estudiantes, incluso cuando el presunto agresor sea otro estudiante, un docente, directivo o personal educativo.

### Documentación operativa

- [Protocolo operativo Modelo A](docs/PROTOCOLO_MODELO_A.md)
- [Prevención, charlas y comunidad](docs/PREVENCION_Y_COMUNIDAD.md)
- [Preguntas frecuentes](docs/PREGUNTAS_FRECUENTES.md)
- [Roadmap y criterios de aceptación](docs/ROADMAP_MODELO_A.md)

### Principios de funcionamiento

1. Protección de la identidad y privacidad del estudiante.
2. Recepción de reportes ocurridos dentro y fuera de la institución.
3. Evaluación de riesgos y seguimiento de los casos.
4. Derivación a las autoridades competentes.
5. Acceso restringido a expedientes sensibles.
6. Prevención mediante charlas y actividades educativas.

### Límites del sistema

Pawtect no sustituye a SíseVe ni a las autoridades competentes. No realiza investigaciones policiales o disciplinarias ni determina culpabilidad.

Las denuncias laborales entre profesores no forman parte del Modelo A.

**Funciones pendientes:** el anonimato pleno, la línea telefónica especial y la integración de WhatsApp requieren desarrollo y validación antes de anunciarse como servicios disponibles.