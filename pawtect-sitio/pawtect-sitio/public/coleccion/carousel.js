(() => {
  'use strict';
  const products = [
    { id: 'band', name: 'PAW BAND', type: 'Pulsera', tagline: 'Tu estilo, tu seguridad', detail: 'Silicona flexible, detalles metálicos y una placa QR integrada en tu muñeca.', hue: 216, finish: 0 },
    { id: 'tag', name: 'PAW TAG', type: 'Llavero', tagline: 'Lleva tu identidad', detail: 'Metal grafito, bordes redondeados y un QR que llevas junto a tus llaves.', hue: 184, finish: 1 },
    { id: 'neck', name: 'PAW NECK', type: 'Collar identificador', tagline: 'Conectado contigo', detail: 'Tejido resistente, cierre de seguridad y una placa QR que te acompaña.', hue: 267, finish: 4 }
  ];
  const finishes = [
    { name: 'Electric Blue', slug: 'blue', hue: 216, accent: '#3ee7ff', base: '#061329', surface: '#12233b', swatch: '#007bff' },
    { name: 'Urban Cyan', slug: 'cyan', hue: 184, accent: '#00e5ea', base: '#101418', surface: '#27343b', swatch: '#00e5ea' },
    { name: 'Fire Energy', slug: 'fire', hue: 12, accent: '#ff935c', base: '#260d15', surface: '#461b25', swatch: '#ff542c' },
    { name: 'Arctic White', slug: 'arctic', hue: 205, accent: '#075aa5', base: '#e2ecf5', surface: '#f0f6fa', swatch: '#eef6ff' },
    { name: 'Violet Noir', slug: 'violet', hue: 267, accent: '#bb9aff', base: '#100b1e', surface: '#30144e', swatch: '#8b5cf6' },
    { name: 'Dorado Premium', slug: 'gold', hue: 43, accent: '#f6d396', base: '#211b11', surface: '#392c1b', swatch: '#d9b575' }
  ];
  const $ = id => document.getElementById(id);
  const stage = $('stage'), reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [], dots = [], swatches = [], scenes = [];
  const choices = products.map(p => p.finish);
  let current = 0, busy = false, ready = false, idle = [];
  const imagePromises = [];
  const safeDecode = img => img.decode ? img.decode() : new Promise((resolve, reject) => {
    if (img.complete) return img.naturalWidth ? resolve() : reject(new Error(img.src));
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', reject, { once: true });
  });
  function layer(p, group, ext, cls) {
    const img = new Image();
    img.alt = '';
    img.className = cls;
    img.draggable = false;
    img.src = 'assets/' + group + '-' + p.id + '.' + ext;
    imagePromises.push(safeDecode(img));
    return img;
  }
  function button(parent, cls, label, handler) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls;
    b.setAttribute('aria-label', label);
    b.addEventListener('click', handler);
    $(parent).append(b);
    return b;
  }
  function selected(btn, active) {
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  products.forEach((p, index) => {
    const scene = document.createElement('div');
    scene.className = 'scene';
    // Share one stacking context so both products stay above both backdrops.
    scene.style.display = 'contents';
    scene.setAttribute('aria-hidden', 'true');
    scene.style.visibility = index ? 'hidden' : 'visible';
    const bg = layer(p, 'bg', 'jpg', 'background');
    const decor = layer(p, 'deco', 'png', 'decor');
    const product = layer(p, 'product', 'png', 'product');
    bg.style.zIndex = '0'; decor.style.zIndex = '2'; product.style.zIndex = '4';
    scene.append(bg, decor, product);
    $('scenes').append(scene);
    scenes.push({ scene, bg, decor, product });
    const card = button('cards', 'card', 'Ver ' + p.name + ', ' + p.type, () => go(index));
    const thumb = product.cloneNode();
    thumb.className = 'thumb';
    const label = document.createElement('span'); label.textContent = p.name;
    card.append(thumb, label);
    cards.push(card);
    dots.push(button('dots', 'dot', 'Mostrar ' + p.name, () => go(index)));
  });
  finishes.forEach((f, i) => {
    const swatch = button('swatches', 'swatch', f.name, () => {
      if (!ready || busy || choices[current] === i) return;
      choices[current] = i;
      paintScene(current); paintUI();
    });
    swatch.title = f.name;
    swatch.style.setProperty('--swatch', f.swatch);
    swatches.push(swatch);
  });
  function paintScene(index) {
    const p = products[index], f = finishes[choices[index]], { bg, decor, product } = scenes[index];
    let productFilter = 'none', backdropFilter = 'none';
    if (f.slug === 'arctic') {
      productFilter = 'grayscale(1) brightness(1.7) contrast(.82)';
      backdropFilter = 'grayscale(1) invert(.94) sepia(.14) hue-rotate(160deg)';
    } else if (choices[index] !== p.finish) {
      const tint = 'hue-rotate(' + (f.hue - p.hue) + 'deg)';
      productFilter = tint + (f.slug === 'gold' ? ' saturate(.76) brightness(1.12)' : '');
      backdropFilter = productFilter;
    }
    bg.style.filter = backdropFilter;
    decor.style.filter = productFilter;
    product.style.filter = (productFilter === 'none' ? '' : productFilter + ' ') + 'drop-shadow(0 22px 16px rgba(0,0,0,.28))';
    cards[index].firstChild.style.filter = productFilter;
  }
  function paintUI() {
    const p = products[current], f = finishes[choices[current]], light = f.slug === 'arctic';
    stage.dataset.finish = f.slug;
    const tokens = {accent:f.accent, base:f.base, surface:f.surface, ink:light?'#0c2033':'#f4f7fc', muted:light?'#374e60':'#bfd0dc', 'on-accent':light?'#ffffff':'#071522'};
    for (const [k,v] of Object.entries(tokens)) stage.style.setProperty('--' + k, v);
    $('title').textContent = p.name;
    $('tagline').textContent = p.tagline.toUpperCase();
    $('detail').textContent = p.detail;
    $('finish').textContent = f.name;
    cards.forEach((b,i) => selected(b,i === current));
    dots.forEach((b,i) => selected(b,i === current));
    swatches.forEach((b,i) => selected(b,i === choices[current]));
    stage.dispatchEvent(new CustomEvent('pawtect:change', {detail:{...p, finish:f.name}}));
  }
  function rest() {
    idle.forEach(a => a.cancel()); idle = [];
    if (reduced.matches || busy) return;
    const {bg,decor} = scenes[current];
    idle = [
      decor.animate([{translate:'0 -2px'},{translate:'0 3px'}],{duration:4600,iterations:Infinity,direction:'alternate',easing:'ease-in-out'}),
      bg.animate([{opacity:1},{opacity:.96}],{duration:5600,iterations:Infinity,direction:'alternate',easing:'ease-in-out'})
    ];
  }
  const textNodes = [$('title'), $('tagline'), $('detail')];
  async function go(next, sync = true) {
    if (!ready || busy || next === current || !Number.isInteger(next) || !products[next]) return;
    busy = true; rest();
    const old = scenes[current], target = scenes[next];
    const minimal = reduced.matches, duration = minimal ? 230 : 900;
    const runs = [];
    const run = (el,frames,time=duration) => {
      const animation = el.animate(frames,{duration:time,easing:'cubic-bezier(.45,0,.55,1)',fill:'both'});
      runs.push(animation);
      return animation;
    };
    const fades = incoming => incoming ? [{opacity:0},{opacity:1}] : [{opacity:1},{opacity:0}];
    try {
      paintScene(next);
      target.bg.style.zIndex = '1'; target.decor.style.zIndex = '3'; target.product.style.zIndex = '5';
      target.scene.style.visibility = 'visible';
      // The opaque outgoing background remains underneath the incoming fade.
      run(target.bg,fades(true));
      run(old.decor,minimal?fades(false):[{opacity:1,scale:'1'},{opacity:0,scale:'.94',translate:'0 -2%'}]);
      run(target.decor,minimal?fades(true):[{opacity:0,scale:'1.1'},{opacity:1,scale:'1'}]);
      const centered = 'translate(-50%, -50%) perspective(1000px)';
      const original = {opacity:1,transform:centered + ' translateX(0) rotateY(0deg) scale(1)'};
      run(old.product,minimal?fades(false):[original,{opacity:0,transform:centered + ' translateX(43%) rotateY(120deg) scale(.84)'}]);
      run(target.product,minimal?fades(true):[{opacity:0,transform:centered + ' translateX(-43%) rotateY(-120deg) scale(.84)'},original]);
      const out = textNodes.map(el => run(el,minimal?fades(false):[{opacity:1,translate:'0'},{opacity:0,translate:'0 -7px'}],duration*.23));
      current = next;
      if (sync) align();
      await Promise.all(out.map(a => a.finished));
      paintUI(); out.forEach(a => a.cancel());
      textNodes.forEach(el => run(el,minimal?fades(true):[{opacity:0,translate:'0 7px'},{opacity:1,translate:'0'}],duration*.44));
      await Promise.allSettled(runs.filter(a => a.playState !== 'idle').map(a => a.finished));
    } finally {
      old.scene.style.visibility = 'hidden';
      target.bg.style.zIndex = '0'; target.decor.style.zIndex = '2'; target.product.style.zIndex = '4';
      runs.forEach(a => a.cancel()); busy = false; rest();
    }
  }
  const inDialog = () => Boolean(document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])'));
  const section = stage.parentElement;
  function align() {
    const anchor = window.scrollY + section.getBoundingClientRect().top;
    const step = Math.max(0, section.offsetHeight-stage.offsetHeight)/(products.length-1);
    if (step) window.scrollTo({top: anchor + current*step,behavior:'instant'});
  }
  let wheelTimer, wheelUsed = false, accumulated = 0;
  stage.addEventListener('wheel', e => {
    if (e.ctrlKey || inDialog() || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {wheelUsed=false; accumulated=0;},165);
    if (!ready || busy || wheelUsed) return;
    accumulated += e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1);
    if (Math.abs(accumulated) < 22) return;
    wheelUsed = true; go(current + Math.sign(accumulated));
  }, {passive:false});
  let touch;
  stage.addEventListener('touchstart', e => {
    touch = !busy && ready && !inDialog() && e.touches.length === 1 ? [e.touches[0].clientX,e.touches[0].clientY] : null;
  }, {passive:true});
  stage.addEventListener('touchcancel',() => {touch=null;});
  stage.addEventListener('touchend', e => {
    if (!touch || inDialog()) return;
    const dx=e.changedTouches[0].clientX-touch[0], dy=e.changedTouches[0].clientY-touch[1];
    touch=null;
    if (Math.abs(dy)>36 && Math.abs(dy)>Math.abs(dx)*1.25) go(current-Math.sign(dy));
  }, {passive:true});
  document.addEventListener('keydown', e => {
    if (inDialog() || e.altKey || e.metaKey || e.ctrlKey || e.target.closest('input,textarea,select,[contenteditable=true]')) return;
    const steps = {ArrowRight:current+1,ArrowDown:current+1,PageDown:current+1,ArrowLeft:current-1,ArrowUp:current-1,PageUp:current-1,Home:0,End:products.length-1};
    if (!(e.key in steps)) return;
    e.preventDefault(); if (!e.repeat) go(steps[e.key]);
  });
  let scrollTimer;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      if (busy || !ready || inDialog()) return;
      const span = section.offsetHeight-stage.offsetHeight;
      if (span <= 0) return;
      const index = Math.min(products.length-1,Math.max(0,Math.round(-section.getBoundingClientRect().top/span*(products.length-1))));
      go(index,false);
    },70);
  },{passive:true});
  stage.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || reduced.matches || busy) return;
    const bounds = stage.getBoundingClientRect();
    scenes[current].decor.style.objectPosition = 'calc(50% + ' + ((e.clientX-bounds.left)/bounds.width*6-3) + 'px) calc(50% + ' + ((e.clientY-bounds.top)/bounds.height*4-2) + 'px)';
  });
  reduced.addEventListener('change', () => {
    scenes.forEach(({decor}) => {decor.style.objectPosition='center';}); rest();
  });
  $('title').setAttribute('aria-live','polite');
  $('title').setAttribute('aria-atomic','true');
  paintScene(0); paintUI();
  window.pawtect = {go, get current(){return {...products[current],finish:finishes[choices[current]].name};}, get index(){return current;}, get ready(){return ready;}};
  Promise.allSettled(imagePromises).then(results => {
    if (results.some(result => result.status === 'rejected')) {
      stage.dataset.assetError = 'true';
      const error = document.createElement('p'); error.setAttribute('role','alert');
      error.textContent = 'Algunas imágenes no se pudieron cargar. Vuelve a abrir la página para ver la colección completa.';
      $('cards').after(error);
      return;
    }
    ready=true; align(); rest();
  });
})();
