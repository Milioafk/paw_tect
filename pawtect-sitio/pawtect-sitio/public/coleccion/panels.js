const panel = document.querySelector('#panel');
const panelTitle = document.querySelector('#panelTitle');
const panelBody = document.querySelector('#panelBody');
const information = {
  nosotros: ['Conoce PAWTECT', 'PAWTECT nació como proyecto del Equipo Gotita Azul en el Laboratorio de Liderazgo e Innovación de la Universidad Continental. Tu accesorio conecta con un espacio digital de seguridad y bienestar escolar. La pulsera, el llavero y el collar ofrecen tres formas de llevar ese acceso contigo.'],
  funciona: ['Cómo funciona', 'Escanea la placa QR con la cámara de tu celular. Abre el enlace de PAWTECT y elige la herramienta que necesitas. Para comunicar una situación debes iniciar el reporte desde la plataforma.'],
  seguridad: ['Seguridad escolar', 'Si algo te preocupa en tu entorno escolar, puedes comunicar lo ocurrido o explorar los recursos de bienestar.'],
  bienestar: ['Bienestar', 'Encuentra orientación en la plataforma PAWTECT. También puedes conversar con una persona de confianza de tu colegio.'],
  reportar: ['Reportar una situación', 'Continúa en la plataforma PAWTECT para describir lo ocurrido. Escanear un accesorio abre el sitio. El reporte se inicia cuando tú lo decides.'],
  contacto: ['Contacto', 'Consulta en la plataforma PAWTECT los canales disponibles para tu institución.'],
  login: ['Iniciar sesión', 'Accede a tu cuenta desde la plataforma PAWTECT.'],
  join: ['Únete a PAWTECT', 'Abre la plataforma PAWTECT para consultar las opciones de registro.'],
  menu: ['Menú','']
};
function addAction(label, action) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.action = action;
  panelBody.append(button);
}
function showPanel(action) {
  const routes = {login:'/login.html',join:'/colegios.html',reportar:'/ayuda.html',bienestar:'/psicologia.html',contacto:'/colegios.html',seguridad:'/',nosotros:'/guia.html',funciona:'/guia.html'};
  if (routes[action]) { const path = routes[action];
    const practice = new URLSearchParams(location.search).get('demo') === '1';
    location.assign(practice ? '/demo' + (path === '/' ? '/index.html' : path) : path); return; }
  if (action === 'inicio' || action === 'accesorios') {
    if (panel.open) panel.close();
    if (action === 'inicio') window.pawtect?.go(0);
    else document.querySelector('#cards button')?.focus();
    return;
  }
  const product = window.pawtect?.current;
  const content = action === 'producto' && product ? [product.name,product.detail] : information[action];
  if (!content) return;
  panelTitle.textContent = content[0];
  panelBody.replaceChildren();
  if (content[1]) {
    const paragraph = document.createElement('p');
    paragraph.textContent = content[1];
    panelBody.append(paragraph);
  }
  if (action === 'menu') {
    Object.entries({inicio:'Inicio',nosotros:'Nosotros',accesorios:'Accesorios',seguridad:'Seguridad',contacto:'Contacto'}).forEach(([key,label]) => addAction(label,key));
  } else if (action === 'seguridad') {
    addAction('Reportar','reportar');
    addAction('Bienestar','bienestar');
  } else if (['producto','nosotros'].includes(action)) {
    addAction('Cómo funciona','funciona');
  } else {
    const link = document.createElement('a');
    link.href = window.platformLinks[{reportar:'report',bienestar:'wellbeing',contacto:'contact'}[action] || action] || window.platformLinks.home;
    link.textContent = 'Abrir plataforma PAWTECT ↗';
    link.target = '_blank';
    link.rel = 'noopener';
    panelBody.append(link);
    if (action === 'funciona') {
      const qr = document.createElement('img');
      qr.src = 'assets/qr.png';
      qr.alt = 'Código QR de la plataforma PAWTECT';
      qr.style.cssText = 'display:block;width:115px;margin-top:18px;background:white;border:5px solid white';
      panelBody.append(qr);
    }
  }
  if (!panel.open) panel.showModal();
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) showPanel(button.dataset.action);
});
panel.querySelector('.close').onclick = () => panel.close();
panel.addEventListener('click',event => {
  const box = panel.getBoundingClientRect();
  if (event.target === panel && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) panel.close();
});
