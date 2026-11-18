/* ==========================================================
   CONFIGURACIÓN DEL EVENTO
   Todo lo que hay que editar está acá. Los valores marcados
   con "PENDIENTE" son de ejemplo hasta tener el dato real.
   ========================================================== */
const CONFIG = {
  // Fecha y hora de inicio (hora de Argentina, -03:00)
  inicio: "2026-12-12T20:00:00-03:00",
  fin:    "2026-12-13T03:00:00-03:00",   // hora de cierre (solo se usa en el calendario)
  hora:   "20 hs",

  // Pago en 2 cuotas (cada cuota es la mitad del precio)
  cuotas: {
    primera: "30 de noviembre",
    segunda: "10 de diciembre",
  },

  lugar: "Restaurante Club Mendoza de Regatas, Av. Las Palmeras, Mendoza",

  // Precio por categoría. "categorias" arma el menú del formulario.
  precios: [
    { nombre: "7ma, 8va, 9na y 10ma", valor: 35000, categorias: ["7ma", "8va", "9na", "10ma"] },
    { nombre: "6ta, 5ta y PS", valor: 70000, categorias: ["6ta", "5ta", "PS"] },
  ],

  // URL de la aplicación web de Google Apps Script (ver apps-script/Code.gs).
  // Mientras diga PENDIENTE, el formulario funciona en "modo prueba" y no guarda nada.
  sheetsUrl: "PENDIENTE",

  // Pago por transferencia
  pago: {
    alias:   "delfi.palacios123",
    titular: "Delfina Nahir Palacios Gomez", // para que la gente verifique antes de transferir
  },

  links: {
    mercadoPago: "https://mpago.la/1FUsoKa", // link de pago de Mercado Pago
  },
};

/* ==========================================================
   No hace falta tocar nada de acá para abajo.
   ========================================================== */

const TITULO = "Cena de Fin de Año del Hockey · Regatas Andino";

function toGCalDate(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}


const formatoPesos = (n) => "$ " + Number(n).toLocaleString("es-AR");

CONFIG.links.maps =
  "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(CONFIG.lugar);

CONFIG.links.googleCalendar =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent(TITULO) +
  "&dates=" + toGCalDate(CONFIG.inicio) + "/" + toGCalDate(CONFIG.fin) +
  "&location=" + encodeURIComponent(CONFIG.lugar) +
  "&details=" + encodeURIComponent("¡Te esperamos! " + location.href.split("#")[0]);

// Links
document.querySelectorAll("[data-link]").forEach((el) => {
  const url = CONFIG.links[el.dataset.link];
  if (url) el.href = url;
});

// Textos
const setText = (sel, txt) => document.querySelectorAll(sel).forEach((el) => (el.textContent = txt));
setText("[data-hora]", CONFIG.hora);
setText("[data-cuota1]", CONFIG.cuotas.primera);
setText("[data-cuota2]", CONFIG.cuotas.segunda);
setText("[data-alias]", CONFIG.pago.alias);
setText("[data-titular]", CONFIG.pago.titular);

// Copiar alias
(function copiarAlias() {
  const btn = document.querySelector("[data-copiar]");
  if (!btn) return;
  const label = btn.querySelector("span");

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  let timer;
  btn.addEventListener("click", async () => {
    const text = CONFIG.pago.alias;
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      ok = fallbackCopy(text);
    }
    label.textContent = ok ? "¡Alias copiado! ✓" : "Mantené apretado el alias para copiarlo";
    btn.classList.toggle("is-done", ok);
    if (ok && typeof confetti === "function") {
      const r = btn.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top, 40);
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      label.textContent = "Copiar alias";
      btn.classList.remove("is-done");
    }, 2500);
  });
})();

// Pestañas del menú (6ta, 5ta y PS / 7ma a 10ma)
(function tabsMenu() {
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  if (!tabs.length) return;
  function activar(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activar(t));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const sig = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      activar(sig);
      sig.focus();
    });
  });
})();

// Precios
const pricesEl = document.querySelector("[data-prices]");
if (pricesEl) {
  CONFIG.precios.forEach(({ nombre, valor }) => {
    const li = document.createElement("li");
    li.innerHTML = '<span></span><div class="prices__val"><strong></strong><small></small></div>';
    li.querySelector("span").textContent = nombre;
    li.querySelector("strong").textContent = formatoPesos(valor);
    li.querySelector("small").textContent = "o 2 cuotas de " + formatoPesos(valor / 2);
    pricesEl.appendChild(li);
  });
}

// Cuenta regresiva
(function countdown() {
  const box = document.querySelector("[data-countdown]");
  if (!box) return;
  const target = new Date(CONFIG.inicio).getTime();
  const pad = (n) => String(n).padStart(2, "0");
  const els = { d: box.querySelector("[data-d]"), h: box.querySelector("[data-h]"),
                m: box.querySelector("[data-m]"), s: box.querySelector("[data-s]") };

  function tick() {
    let diff = Math.max(0, target - Date.now());
    if (diff === 0) {
      box.outerHTML = '<p class="section__title">¡Hoy es la cena!</p>';
      return;
    }
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5);  diff -= h * 36e5;
    const m = Math.floor(diff / 6e4);   diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    els.d.textContent = d; els.h.textContent = pad(h);
    els.m.textContent = pad(m); els.s.textContent = pad(s);
    setTimeout(tick, 1000);
  }
  tick();
})();

// Aparición de secciones al hacer scroll
(function reveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
})();

// Barra fija: aparece cuando se deja la portada
(function dock() {
  const dockEl = document.querySelector(".dock");
  const hero = document.querySelector(".hero");
  if (!dockEl || !hero || !("IntersectionObserver" in window)) return;
  new IntersectionObserver(([e]) => {
    dockEl.classList.toggle("is-visible", !e.isIntersecting);
  }, { threshold: 0.25 }).observe(hero);
})();

// Cielo estrellado
(function stars() {
  const canvas = document.querySelector(".stars");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w, h, list = [];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 4500);
    list = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h * 0.8,
      r: Math.random() * 1.2 + 0.2,
      p: Math.random() * Math.PI * 2,
      v: Math.random() * 0.02 + 0.005,
    }));
  }

  let running = true;
  function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const s of list) {
      s.p += s.v;
      ctx.globalAlpha = 0.35 + Math.sin(s.p) * 0.35 + 0.3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    if (running && !reduce) requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize);
  // Pausar cuando la portada no se ve (ahorra batería)
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      const was = running;
      running = e.isIntersecting;
      if (running && !was) draw();
    }).observe(canvas);
  }
})();

/* ==========================================================
   INTERACTIVO
   ========================================================== */

const REDUCE_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Papelitos (azul, rojo y blanco). x, y en píxeles de pantalla.
const confetti = (function () {
  let canvas, ctx, parts = [], running = false;
  const COLORS = ["#d0282f", "#3344b5", "#ffffff", "#8d9bff"];

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.y < innerHeight + 20 && p.life > 0);
    for (const p of parts) {
      p.vy += 0.18; p.vx *= 0.99; p.vy *= 0.99;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.min(1, p.life / 30);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)));
      ctx.restore();
    }
    if (parts.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  }

  return function (x, y, count = 120) {
    if (REDUCE_MOTION) return;
    ensureCanvas();
    resize();
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const s = 4 + Math.random() * 8;
      parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
        c: COLORS[(Math.random() * COLORS.length) | 0], life: 110 + Math.random() * 60,
      });
    }
    if (!running) { running = true; requestAnimationFrame(frame); }
  };
})();

// 1) Tiro al arco en la portada
(function tiroAlArco() {
  const pitch = document.querySelector(".pitch");
  if (!pitch) return;
  const svg = pitch.querySelector("svg");
  const ball = svg.querySelector(".pitch__ball");
  const keeper = svg.querySelector(".pitch__keeper");
  const grab = pitch.querySelector(".pitch__grab");
  const hint = pitch.querySelector(".pitch__hint");
  const toast = pitch.querySelector(".pitch__toast");

  const START = { x: 200, y: 148 };
  const R = 5;
  const GOAL = { line: 60, back: 46, x1: 160, x2: 240 };
  const KEEPER = { y: 70, half: 13, amp: 28 };

  let state = "idle";   // idle | flying | goal | saved | miss
  let b = { ...START }, v = { x: 0, y: 0 };
  let goles = 0, kx = 200, last = 0, active = true, alpha = 1, resetTimer;

  const toSvg = (cx, cy) => {
    const p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  };

  function placeGrab() {
    const p = svg.createSVGPoint();
    p.x = START.x; p.y = START.y;
    const s = p.matrixTransform(svg.getScreenCTM());
    const r = pitch.getBoundingClientRect();
    grab.style.left = s.x - r.left + "px";
    grab.style.top = s.y - r.top + "px";
  }

  function draw() {
    ball.setAttribute("cx", b.x.toFixed(1));
    ball.setAttribute("cy", b.y.toFixed(1));
    ball.style.opacity = alpha;
    keeper.setAttribute("transform", `translate(${kx.toFixed(1)} ${KEEPER.y})`);
  }

  function showToast(title, sub, cta) {
    toast.querySelector("strong").textContent = title;
    toast.querySelector("span").textContent = sub;
    toast.querySelector("a").hidden = !cta;
    toast.classList.add("is-show");
  }

  function reset() {
    toast.classList.remove("is-show");
    b = { ...START }; v = { x: 0, y: 0 }; alpha = 1;
    state = "idle";
    pitch.classList.add("is-idle");
    hint.textContent = goles
      ? `🏑 Goles: ${goles} · ¡Patea otra!`
      : "🏑 Deslizá la bocha hacia el arco";
    draw();
  }

  function finish(result) {
    state = result;
    if (result === "goal") {
      goles++;
      const p = svg.createSVGPoint();
      p.x = b.x; p.y = b.y;
      const s = p.matrixTransform(svg.getScreenCTM());
      confetti(s.x, s.y, 140);
      if (navigator.vibrate) navigator.vibrate(60);
      showToast(goles > 1 ? `¡GOOOL! ×${goles}` : "¡GOOOL!", "Nos vemos el sábado 12/12", true);
    } else if (result === "saved") {
      showToast("¡Atajó!", "El arquero está atento. Probá de nuevo", false);
    } else {
      showToast("¡Afuera!", "Casi… probá de nuevo", false);
    }
    clearTimeout(resetTimer);
    resetTimer = setTimeout(reset, result === "goal" ? 2800 : 1700);
  }

  function shoot(dx, dy, speed) {
    if (state !== "idle") return;
    const len = Math.hypot(dx, dy);
    if (len < 1 || dy > -0.2 * len) return; // tiene que ir hacia el arco
    v = { x: (dx / len) * speed, y: (dy / len) * speed };
    state = "flying";
    pitch.classList.remove("is-idle");
  }

  function step() {
    if (!active) return;
    const now = performance.now();
    const dt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;

    // El arquero se mueve más rápido con cada gol
    const w = Math.min(1.6 + goles * 0.35, 4);
    kx = 200 + KEEPER.amp * Math.sin((now / 1000) * w);

    if (state === "flying") {
      const prevY = b.y;
      b.x += v.x * dt; b.y += v.y * dt;

      const crossesKeeper = prevY - R > KEEPER.y + 5 ? b.y - R <= KEEPER.y + 5 : (b.y - R <= KEEPER.y + 5 && b.y + R >= KEEPER.y - 5);
      if (crossesKeeper && Math.abs(b.x - kx) < KEEPER.half + R) {
        v.y = Math.abs(v.y) * 0.45;
        v.x = v.x * 0.5 + (b.x - kx) * 6;
        finish("saved");
      } else if (b.y <= GOAL.line) {
        if (b.x > GOAL.x1 + R && b.x < GOAL.x2 - R) {
          b.y = Math.max(b.y, GOAL.back + R);
          v = { x: 0, y: 0 };
          finish("goal");
        } else {
          finish("miss");
        }
      } else if (b.x < -10 || b.x > 410) {
        finish("miss");
      }
    } else if (state === "saved" || state === "miss") {
      const f = Math.pow(0.15, dt);
      v.x *= f; v.y *= f;
      b.x += v.x * dt; b.y += v.y * dt;
      alpha = Math.max(0, alpha - dt * 0.8);
    }

    draw();
    requestAnimationFrame(step);
  }

  // Deslizar desde la bocha
  let start = null;
  grab.addEventListener("pointerdown", (e) => {
    if (state !== "idle") return;
    grab.setPointerCapture(e.pointerId);
    const p = toSvg(e.clientX, e.clientY);
    start = { x: p.x, y: p.y, t: performance.now() };
    grab.style.cursor = "grabbing";
  });
  grab.addEventListener("pointerup", (e) => {
    grab.style.cursor = "";
    if (!start) return;
    const end = toSvg(e.clientX, e.clientY);
    const dx = end.x - start.x, dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const secs = Math.max(0.05, (performance.now() - start.t) / 1000);
    start = null;
    if (dist < 8) {
      shoot((Math.random() - 0.5) * 30, -88, 420); // toque: tiro al medio
    } else {
      shoot(dx, dy, Math.min(650, Math.max(300, dist / secs)));
    }
  });
  grab.addEventListener("pointercancel", () => { start = null; grab.style.cursor = ""; });
  // Teclado (Enter / Espacio)
  grab.addEventListener("click", (e) => {
    if (e.detail === 0) shoot((Math.random() - 0.5) * 30, -88, 420);
  });

  // Tocar un punto de la cancha: patea hacia ahí
  svg.addEventListener("click", (e) => {
    const p = toSvg(e.clientX, e.clientY);
    shoot(p.x - START.x, p.y - START.y, 460);
  });

  placeGrab();
  window.addEventListener("resize", placeGrab);
  document.fonts && document.fonts.ready.then(placeGrab);

  // Pausar cuando la portada no se ve
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      const was = active;
      active = e.isIntersecting;
      if (active && !was) { last = 0; requestAnimationFrame(step); }
    }).observe(pitch);
  }
  requestAnimationFrame(step);
})();

// 2) Festejo de gol: se muestra al confirmar el lugar
const festejarGol = (function () {
  const overlay = document.querySelector(".gol");
  if (!overlay) return () => {};
  const msg = overlay.querySelector(".gol__msg");
  let timer;

  function hide() { overlay.classList.remove("is-on"); overlay.hidden = true; }
  overlay.addEventListener("click", hide);

  return function (texto) {
    msg.textContent = texto;
    overlay.hidden = false;
    overlay.classList.remove("is-on");
    void overlay.offsetWidth; // reiniciar animaciones
    overlay.classList.add("is-on");
    setTimeout(() => confetti(innerWidth / 2, innerHeight * 0.45, 160), 600);
    clearTimeout(timer);
    timer = setTimeout(hide, 3200);
  };
})();

// Formulario: datos + comprobante → Google Sheets (vía Apps Script)
(function formulario() {
  const form = document.querySelector("[data-form]");
  if (!form) return;
  const ok = document.querySelector("[data-form-ok]");
  const errorEl = form.querySelector("[data-form-error]");
  const submitBtn = form.querySelector(".form__submit");
  const submitLabel = form.querySelector("[data-submit-label]");
  const select = form.querySelector("[data-categorias]");
  const totalEl = form.querySelector("[data-total]");
  const upload = form.querySelector("[data-upload]");
  const uploadLabel = form.querySelector("[data-upload-label]");
  const fileInput = form.elements.comprobante;
  const MAX_ARCHIVO = 8 * 1024 * 1024;

  // Menú de categorías a partir de CONFIG.precios
  const precioPorCategoria = {};
  CONFIG.precios.forEach((p) => p.categorias.forEach((c) => {
    precioPorCategoria[c] = p.valor;
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = `${c} · ${formatoPesos(p.valor)}`;
    select.appendChild(opt);
  }));

  const tipoPago = () => (form.querySelector('input[name="pago"]:checked') || {}).value || "Total";

  function montoActual() {
    const precio = precioPorCategoria[select.value];
    const cant = Math.max(1, parseInt(form.elements.cantidad.value, 10) || 1);
    if (!precio) return 0;
    return tipoPago() === "Total" ? precio * cant : (precio / 2) * cant;
  }
  function actualizarTotal() {
    const m = montoActual();
    totalEl.hidden = !m;
    if (!m) return;
    const tipo = tipoPago();
    totalEl.firstChild.textContent = tipo === "Total" ? "Total a transferir: " : `${tipo} a transferir: `;
    totalEl.querySelector("strong").textContent = formatoPesos(m);
  }
  select.addEventListener("change", actualizarTotal);
  form.elements.cantidad.addEventListener("input", actualizarTotal);
  form.querySelectorAll('input[name="pago"]').forEach((r) => r.addEventListener("change", actualizarTotal));

  fileInput.addEventListener("change", () => {
    const f = fileInput.files[0];
    upload.classList.toggle("has-file", !!f);
    upload.classList.remove("is-invalid");
    uploadLabel.textContent = f ? `✓ ${f.name}` : "Subir captura o PDF";
  });

  form.addEventListener("input", (e) => e.target.classList && e.target.classList.remove("is-invalid"));

  function mostrarError(texto) {
    errorEl.textContent = texto;
    errorEl.hidden = !texto;
  }

  function validar() {
    let primero = null;
    ["nombre", "categoria", "cantidad", "titular"].forEach((n) => {
      const el = form.elements[n];
      const vacio = !String(el.value).trim() || (n === "cantidad" && !(parseInt(el.value, 10) >= 1));
      el.classList.toggle("is-invalid", vacio);
      if (vacio && !primero) primero = el;
    });
    const f = fileInput.files[0];
    if (!f) {
      upload.classList.add("is-invalid");
      if (!primero) primero = fileInput;
    } else if (f.size > MAX_ARCHIVO && !/^image\//.test(f.type)) {
      upload.classList.add("is-invalid");
      mostrarError("El PDF es muy pesado (máx. 8 MB). Probá con una captura de pantalla.");
      return false;
    }
    if (primero) {
      mostrarError("Completá los campos marcados en rojo.");
      primero.focus({ preventScroll: true });
      primero.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    mostrarError("");
    return true;
  }

  // Achica las fotos para que suban rápido con datos móviles
  async function achicar(bmp, ladoMax, calidad) {
    const escala = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; // fondo blanco para PNG con transparencia
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, "image/jpeg", calidad));
  }

  async function prepararArchivo(file) {
    if (/^image\//.test(file.type) && !/gif|svg/.test(file.type)) {
      try {
        const bmp = await createImageBitmap(file);
        const blob = await achicar(bmp, 1600, 0.82);
        // Miniatura para ver el comprobante directo en la planilla
        const mini = await achicar(bmp, 320, 0.7);
        if (blob) return { blob, mini, tipo: "image/jpeg", nombre: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
      } catch (e) { /* si no se puede procesar, se manda tal cual */ }
    }
    if (file.size > MAX_ARCHIVO) throw new Error("El archivo es muy pesado (máx. 8 MB).");
    return { blob: file, tipo: file.type || "application/octet-stream", nombre: file.name };
  }

  const aBase64 = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1]);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });

  function cargando(si) {
    submitBtn.disabled = si;
    submitLabel.textContent = si ? "Enviando…" : "Confirmar mi lugar";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.disabled || !validar()) return;
    cargando(true);
    try {
      const archivo = await prepararArchivo(fileInput.files[0]);
      const datos = {
        nombre: form.elements.nombre.value.trim(),
        telefono: form.elements.telefono.value.trim(),
        categoria: select.value,
        cantidad: parseInt(form.elements.cantidad.value, 10) || 1,
        pago: tipoPago(),
        monto: montoActual(),
        titular: form.elements.titular.value.trim(),
        comentarios: form.elements.comentarios.value.trim(),
        website: form.elements.website.value,
        archivo: {
          nombre: archivo.nombre,
          tipo: archivo.tipo,
          base64: await aBase64(archivo.blob),
          miniatura: archivo.mini ? await aBase64(archivo.mini) : "",
        },
      };

      if (!/^https:\/\/script\.google\.com\//.test(CONFIG.sheetsUrl)) {
        // Modo prueba: todavía no está conectada la planilla
        console.warn("[Invitación] CONFIG.sheetsUrl no está configurada: el formulario no guardó nada.", { ...datos, archivo: { ...datos.archivo, base64: `(${datos.archivo.base64.length} caracteres)`, miniatura: `(${datos.archivo.miniatura.length} caracteres)` } });
        await new Promise((r) => setTimeout(r, 900));
      } else {
        // text/plain evita el "preflight" CORS que Apps Script no soporta
        const res = await fetch(CONFIG.sheetsUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(datos),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "No se pudo guardar");
      }

      form.hidden = true;
      ok.hidden = false;
      ok.querySelector("[data-ok-cuota]").hidden = datos.pago !== "1ª cuota";
      ok.scrollIntoView({ behavior: "smooth", block: "center" });
      festejarGol("¡Ya estás en la lista!");
    } catch (err) {
      console.error(err);
      mostrarError(
        err && /pesado/.test(err.message)
          ? err.message
          : "No pudimos enviar tus datos. Revisá tu conexión y probá de nuevo."
      );
    } finally {
      cargando(false);
    }
  });

  document.querySelector("[data-form-otra]").addEventListener("click", () => {
    form.reset();
    fileInput.dispatchEvent(new Event("change"));
    actualizarTotal();
    ok.hidden = true;
    form.hidden = false;
    form.elements.nombre.focus();
  });
})();

// 3) La jugada: la bocha baja con el scroll, pasándose de un lado al otro
(function jugada() {
  const svg = document.querySelector(".jugada");
  const main = document.querySelector("main");
  const arco = document.querySelector(".footer__goal");
  if (!svg || !main || !arco) return;
  const path = svg.querySelector(".jugada__trail");
  const clip = svg.querySelector("#jugada-clip rect");
  const ball = svg.querySelector(".jugada__ball");

  let samples = [], startY = 0, endY = 0, done = false, queued = false;

  // Posición en el documento sin contar transformaciones (las animaciones de aparición)
  function box(el) {
    let top = 0, left = 0, e = el;
    while (e) { top += e.offsetTop; left += e.offsetLeft; e = e.offsetParent; }
    return { top, left, bottom: top + el.offsetHeight, right: left + el.offsetWidth };
  }

  function build() {
    svg.style.height = "0px";
    const W = document.documentElement.clientWidth;
    const H = document.documentElement.scrollHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.height = H + "px";

    const m = box(main);
    const pts = [{ x: W / 2, y: m.top + 6 }];
    [...main.querySelectorAll(":scope > section")].forEach((s, i) => {
      const r = box(s);
      const izq = i % 2 === 0;
      const x = izq
        ? (r.left >= 36 ? r.left - 18 : 10)
        : (W - r.right >= 36 ? r.right + 18 : W - 10);
      pts.push({ x, y: r.top + 56 }, { x, y: r.bottom - 40 });
    });
    const g = box(arco);
    pts.push({ x: (g.left + g.right) / 2, y: g.top + 22 });

    let d = `M${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], c = pts[i];
      if (Math.abs(a.x - c.x) < 1) d += ` L${c.x} ${c.y}`;
      else {
        const k = (c.y - a.y) / 2;
        d += ` C${a.x} ${a.y + k} ${c.x} ${c.y - k} ${c.x} ${c.y}`;
      }
    }
    path.setAttribute("d", d);

    const total = path.getTotalLength();
    samples = [];
    for (let i = 0, N = 400; i <= N; i++) {
      const p = path.getPointAtLength((total * i) / N);
      samples.push({ x: p.x, y: p.y });
    }
    startY = pts[0].y;
    endY = pts[pts.length - 1].y;
    update();
  }

  function pointAtY(y) {
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].y < y) lo = mid + 1; else hi = mid;
    }
    const b = samples[lo], a = samples[Math.max(0, lo - 1)];
    const t = b.y === a.y ? 1 : (y - a.y) / (b.y - a.y);
    return { x: a.x + (b.x - a.x) * t, y };
  }

  function update() {
    queued = false;
    if (!samples.length) return;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const raw = scrollY + innerHeight * 0.6;
    const rawMax = maxScroll + innerHeight * 0.6;
    let y = raw <= startY ? raw : startY + ((raw - startY) * (endY - startY)) / Math.max(1, rawMax - startY);
    y = Math.min(y, endY);

    if (y < startY) {
      ball.style.opacity = 0;
      clip.setAttribute("height", 0);
      return;
    }
    const p = pointAtY(y);
    ball.style.opacity = 1;
    ball.setAttribute("cx", p.x.toFixed(1));
    ball.setAttribute("cy", p.y.toFixed(1));
    clip.setAttribute("height", p.y.toFixed(1));

    if (y >= endY - 1 && !done) {
      done = true;
      arco.classList.add("is-gol");
      const r = arco.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 70);
    }
  }

  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", build);
  window.addEventListener("load", build);
  document.fonts && document.fonts.ready.then(build);
  if ("ResizeObserver" in window) new ResizeObserver(build).observe(main);
  build();
})();
