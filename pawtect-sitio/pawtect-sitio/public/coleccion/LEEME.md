# PAWTECT · Colección interactiva

Abre index.html en un navegador moderno. Para desplegarlo, publica el contenido de esta carpeta como sitio estático, conservando las rutas. No necesita compilación, instalación ni claves privadas.

## Navegación

Usa la rueda, un gesto vertical, las flechas del teclado o las tarjetas para recorrer PAW BAND, PAW TAG y PAW NECK. Inicio y Fin seleccionan los extremos de la colección. Los seis círculos de acabado modifican el producto y el ambiente. Cada producto recuerda su acabado durante la visita. El navegador respeta la preferencia de movimiento reducido.

## Archivos

- index.html y style.css contienen la composición, la presentación móvil y los controles.
- carousel.js controla la precarga, las capas, los acabados y las transiciones mediante Web Animations API.
- panels.js contiene las fichas y los paneles de información.
- platform.js centraliza los destinos públicos. Sustituye las entradas por enlaces directos cuando la plataforma los publique.
- assets/ contiene los fondos JPG, adornos transparentes PNG y accesorios transparentes PNG, además del isotipo y el QR de la presentación.

## Conexión con la plataforma

El destino documentado es https://pawtect-pawtect-sitio.vercel.app/. Los accesos a cuenta, registro, reportes, bienestar y contacto continúan allí. Los formularios y el tratamiento de datos pertenecen a la plataforma de destino. La landing no recoge credenciales ni reportes. Si cambia el dominio, actualiza platform.js y las placas QR antes de imprimir los accesorios.
