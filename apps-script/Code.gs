/**
 * Cena de Fin de Año del Hockey · Regatas Andino
 * Recibe el formulario de la invitación, guarda el comprobante en Google Drive
 * y agrega una fila en la planilla.
 *
 * ─────────────────────────────── CÓMO INSTALARLO ───────────────────────────────
 * 1. Crear una planilla nueva en Google Sheets (con la cuenta del club o de quien
 *    organiza). Por ejemplo: "Cena Hockey 2026 – Inscriptos".
 * 2. En la planilla: Extensiones → Apps Script.
 * 3. Borrar lo que haya en el editor, pegar TODO este archivo y guardar (💾).
 * 4. Arriba a la derecha: Implementar → Nueva implementación.
 *      - Tipo (ícono ⚙️): Aplicación web
 *      - Ejecutar como: Yo
 *      - Quién tiene acceso: Cualquier usuario
 *    → Implementar → Autorizar acceso (elegir la cuenta, "Configuración avanzada" →
 *      "Ir a … (no seguro)" → Permitir). Es normal: el script es tuyo.
 * 5. Copiar la "URL de la aplicación web" (termina en /exec) y pegarla en
 *    js/main.js → CONFIG.sheetsUrl.
 *
 * Los comprobantes quedan en una carpeta de tu Google Drive llamada
 * "Comprobantes Cena Hockey" y son PRIVADOS: solo los ve quien tenga acceso a
 * esa carpeta. Para que otra persona de la organización los vea, compartí la
 * planilla y la carpeta con ella.
 *
 * Si más adelante cambiás este código: Implementar → Gestionar implementaciones →
 * ✏️ → Versión: "Nueva versión" → Implementar (así la URL sigue siendo la misma).
 * ────────────────────────────────────────────────────────────────────────────────
 */

const HOJA = 'Inscriptos';
const CARPETA = 'Comprobantes Cena Hockey';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por comprobante

// Tienen que coincidir con las categorías de CONFIG.precios en js/main.js
const CATEGORIAS = ['7ma', '8va', '9na', '10ma', '6ta', '5ta', 'PS'];

// Una columna por categoría con la cantidad de entradas, así se pueden sumar fácil.
const COLUMNAS = [
  'Fecha', 'Nombre y apellido', 'Teléfono', 'Pago',
  ...CATEGORIAS,
  'Total entradas', 'Monto', 'Titular de la cuenta', 'Comprobante', 'Miniatura',
  'Quiénes van', 'Comentarios', 'Pago verificado', 'Ingresaron',
];
const col = (nombre) => COLUMNAS.indexOf(nombre) + 1;
const COL_COMPROBANTE = col('Comprobante');
const COL_MINIATURA = col('Miniatura');
const COL_VERIFICADO = col('Pago verificado');
const COL_MONTO = col('Monto');
const ALTO_FILA_CON_MINIATURA = 110; // píxeles

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = JSON.parse(e.postData.contents);

    // Página de ingreso (/puerta): marcar quién entró
    if (d.accion === 'ingreso') return marcarIngreso(d);

    // Trampa para bots: el campo "website" está oculto en el formulario.
    if (d.website) return responder({ ok: true });

    const obligatorios = ['nombre', 'titular'];
    for (const campo of obligatorios) {
      if (!d[campo] || String(d[campo]).trim() === '') {
        return responder({ ok: false, error: 'Falta el campo: ' + campo });
      }
    }

    // Entradas por categoría (números enteros entre 0 y 20)
    const entradas = CATEGORIAS.map((c) => {
      const n = Math.floor(Number(d.entradas && d.entradas[c]) || 0);
      return Math.min(20, Math.max(0, n));
    });
    const totalEntradas = entradas.reduce((a, b) => a + b, 0);
    if (totalEntradas === 0) return responder({ ok: false, error: 'No se eligió ninguna entrada' });

    const hoja = obtenerHoja();

    // Guardar comprobante en Drive
    let link = '';
    if (d.archivo && d.archivo.base64) {
      const bytes = Utilities.base64Decode(d.archivo.base64);
      if (bytes.length > MAX_BYTES) return responder({ ok: false, error: 'El archivo es demasiado grande' });
      const tipo = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(d.archivo.tipo)
        ? d.archivo.tipo : 'application/octet-stream';
      const fecha = Utilities.formatDate(new Date(), 'America/Argentina/Mendoza', 'yyyy-MM-dd HH.mm');
      const cats = CATEGORIAS.filter((c, i) => entradas[i] > 0).join(' ');
      const nombreArchivo = fecha + ' - ' + limpiar(d.nombre) + ' - ' + cats + ' - ' + limpiar(d.pago || 'Total') + extension(tipo, d.archivo.nombre);
      const archivo = obtenerCarpeta().createFile(Utilities.newBlob(bytes, tipo, nombreArchivo));
      link = archivo.getUrl();
    }

    const pago = ['Total', '1ª cuota', '2ª cuota'].indexOf(d.pago) >= 0 ? d.pago : 'Total';

    // La 2ª cuota paga entradas que ya se contaron con la 1ª: no se vuelven a sumar
    // en las columnas de categorías ni en "Total entradas". Quedan anotadas en
    // Comentarios para poder controlarlas contra la fila de la 1ª cuota.
    const esSegunda = pago === '2ª cuota';
    let comentarios = d.comentarios || '';
    if (esSegunda) {
      const detalle = CATEGORIAS.filter((c, i) => entradas[i] > 0).map((c) => c + ' ×' + entradas[CATEGORIAS.indexOf(c)]).join(' · ');
      comentarios = '[2ª cuota de: ' + detalle + ']' + (comentarios ? ' ' + comentarios : '');
    }

    hoja.appendRow([
      new Date(),
      seguro(d.nombre),
      seguro(d.telefono || ''),
      pago,
      ...entradas.map((n) => (esSegunda ? '' : n || '')),
      esSegunda ? '' : totalEntradas,
      Number(d.monto) || '',
      seguro(d.titular),
      '',
      '',
      seguro(d.asistentes || ''),
      seguro(comentarios),
      false,
    ]);

    const fila = hoja.getLastRow();
    if (link) {
      hoja.getRange(fila, COL_COMPROBANTE).setRichTextValue(
        SpreadsheetApp.newRichTextValue().setText('Ver comprobante').setLinkUrl(link).build()
      );
    } else {
      hoja.getRange(fila, COL_COMPROBANTE).setValue('Sin comprobante');
    }
    hoja.getRange(fila, COL_VERIFICADO).insertCheckboxes();

    // Miniatura dentro de la celda (solo fotos/capturas; los PDF quedan con el link)
    const mini = d.archivo && d.archivo.miniatura;
    if (mini && /^[A-Za-z0-9+/=]+$/.test(mini) && mini.length < 400000) {
      try {
        const imagen = SpreadsheetApp.newCellImage()
          .setSourceUrl('data:image/jpeg;base64,' + mini)
          .setAltTextTitle('Comprobante de ' + limpiar(d.nombre))
          .build();
        hoja.getRange(fila, COL_MINIATURA).setValue(imagen);
        hoja.setRowHeight(fila, ALTO_FILA_CON_MINIATURA);
      } catch (err) {
        hoja.getRange(fila, COL_MINIATURA).setValue('(sin vista previa)');
      }
    } else {
      hoja.getRange(fila, COL_MINIATURA).setValue(link ? '(ver link)' : '');
    }

    return responder({ ok: true });
  } catch (err) {
    return responder({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Para probar que la implementación responde: abrir la URL /exec en el navegador.
// Con ?accion=puerta&clave=… devuelve la lista para la página de ingreso.
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion === 'puerta') {
    if (!claveOk(p.clave)) return responder({ ok: false, error: 'clave' });
    const lista = armarGrupos(leerFilas(obtenerHoja()));
    return responder({ ok: true, actualizado: new Date().toISOString(), grupos: lista.grupos, totales: lista.totales });
  }
  return responder({ ok: true, mensaje: 'El formulario de la Cena del Hockey está funcionando.' });
}

function obtenerHoja() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA);
  if (!hoja) hoja = ss.insertSheet(HOJA);
  if (hoja.getLastRow() === 0) {
    hoja.appendRow(COLUMNAS);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight('bold').setBackground('#0a1a6e').setFontColor('#ffffff');
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
    hoja.getRange(1, COL_MONTO, hoja.getMaxRows(), 1).setNumberFormat('$ #,##0');
    hoja.setColumnWidths(col(CATEGORIAS[0]), CATEGORIAS.length, 48);
    hoja.getRange(1, col(CATEGORIAS[0]), hoja.getMaxRows(), CATEGORIAS.length + 1).setHorizontalAlignment('center');
    hoja.setColumnWidth(COL_MINIATURA, 130);
    hoja.getRange(1, 1, 1000, COLUMNAS.length).setVerticalAlignment('middle');
  }
  return hoja;
}

function obtenerCarpeta() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* se borró: crear otra */ }
  }
  const carpeta = DriveApp.createFolder(CARPETA);
  props.setProperty('CARPETA_ID', carpeta.getId());
  return carpeta;
}

// Evita que un texto que empieza con =, +, - o @ se interprete como fórmula.
function seguro(v) {
  const s = String(v).slice(0, 300).trim();
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function limpiar(v) {
  return String(v).replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 60) || 'sin-nombre';
}

function extension(tipo, nombreOriginal) {
  const m = String(nombreOriginal || '').match(/\.[a-z0-9]{2,5}$/i);
  if (m) return m[0].toLowerCase();
  return { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf' }[tipo] || '';
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ═══════════════════════════ PÁGINA DE INGRESO (/puerta) ═══════════════════════════
 * La página puerta/ del sitio busca a la gente cuando llega y marca cuántos entraron.
 * Para usarla:
 * 1. Cargar la clave: ⚙️ Configuración del proyecto → Propiedades de la secuencia de
 *    comandos → propiedad CLAVE_PUERTA con la clave que quieras. (O elegir la función
 *    "crearClavePuerta" arriba y tocar Ejecutar: inventa una y la muestra en el registro.)
 *    El link para la puerta es URL_PUERTA + "#clave=" + la clave.
 * 2. Implementar → Gestionar implementaciones → ✏️ → Versión: "Nueva versión" → Implementar.
 * Los ingresos se guardan en la columna "Ingresaron" de la hoja Inscriptos.
 * ═══════════════════════════════════════════════════════════════════════════════════ */

// Tienen que coincidir con CONFIG.precios en js/main.js
const PRECIOS = { '7ma': 35000, '8va': 35000, '9na': 35000, '10ma': 35000, '6ta': 70000, '5ta': 70000, 'PS': 70000 };
const URL_PUERTA = 'https://ivancsir.github.io/cena-hockey/puerta/';

function crearClavePuerta() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let clave = '';
  for (let i = 0; i < 10; i++) clave += abc[Math.floor(Math.random() * abc.length)];
  PropertiesService.getScriptProperties().setProperty('CLAVE_PUERTA', clave);
  Logger.log('Clave de la puerta: ' + clave);
  Logger.log('Link para la puerta (ya trae la clave): ' + URL_PUERTA + '#clave=' + clave);
}

function claveOk(clave) {
  const real = PropertiesService.getScriptProperties().getProperty('CLAVE_PUERTA');
  return !!real && String(clave || '') === real;
}

// Columna "Ingresaron": si la planilla es anterior a la página de ingreso, se agrega al final.
function columnaIngresaron(hoja) {
  const enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String);
  const i = enc.indexOf('Ingresaron');
  if (i >= 0) return i + 1;
  const c = hoja.getLastColumn() + 1;
  hoja.getRange(1, c).setValue('Ingresaron').setFontWeight('bold').setBackground('#0a1a6e').setFontColor('#ffffff');
  hoja.getRange(1, c, hoja.getMaxRows(), 1).setHorizontalAlignment('center');
  return c;
}

function leerFilas(hoja) {
  if (hoja.getLastRow() < 2) return [];
  columnaIngresaron(hoja);
  const valores = hoja.getDataRange().getValues();
  const enc = valores[0].map(String);
  const v = (fila, nombre) => { const i = enc.indexOf(nombre); return i >= 0 ? fila[i] : ''; };
  return valores.slice(1).map((r, k) => {
    const entradas = {};
    CATEGORIAS.forEach((c) => { const n = Number(v(r, c)) || 0; if (n > 0) entradas[c] = n; });
    return {
      fila: k + 2,
      nombre: String(v(r, 'Nombre y apellido')).replace(/^'/, '').trim(),
      telefono: String(v(r, 'Teléfono')).replace(/^'/, ''),
      pago: String(v(r, 'Pago')) || 'Total',
      entradas: entradas,
      monto: Number(v(r, 'Monto')) || 0,
      quienes: String(v(r, 'Quiénes van')).replace(/^'/, '').trim(),
      comentarios: String(v(r, 'Comentarios')),
      verificado: v(r, 'Pago verificado') === true,
      ingresaron: Number(v(r, 'Ingresaron')) || 0,
    };
  }).filter((f) => f.nombre);
}

/**
 * Junta cada 1ª cuota con su 2ª cuota y calcula cuánto falta pagar.
 * Una 2ª cuota se une a una 1ª cuota con las mismas entradas y:
 *   1) el mismo teléfono (últimos 7 dígitos), o si no
 *   2) el mismo nombre: todas las palabras del nombre más corto están en el más largo
 *      ("Juan Perez" = "Juan Pérez García"), con al menos 2 palabras.
 * Si no hay un único candidato, no adivina: queda "revisar".
 */
function armarGrupos(filas) {
  const grupos = [];
  const segundas = [];
  filas.forEach((f) => {
    if (f.pago === '2ª cuota') {
      // Desde que la 2ª cuota no suma entradas, el detalle queda en Comentarios
      const m = f.comentarios.match(/\[2ª cuota de: ([^\]]*)\]/);
      if (m) {
        f.entradas = {};
        m[1].split('·').forEach((p) => {
          const x = p.trim().match(/^(\S+)\s*×\s*(\d+)$/);
          if (x) f.entradas[x[1]] = Number(x[2]);
        });
      }
      segundas.push(f);
    } else if (totalDe(f.entradas) > 0) {
      grupos.push({ f: f, cuotas: [], posibles: [], repetida: [] });
    }
  });

  const sueltas = [];
  segundas.forEach((s) => {
    const cats = claveEntradas(s.entradas);
    const cands = grupos.filter((g) => g.f.pago === '1ª cuota' && claveEntradas(g.f.entradas) === cats);
    const t = tel7(s.telefono);
    const porTel = t ? cands.filter((g) => tel7(g.f.telefono) === t) : [];
    let elegido = porTel.length === 1 ? porTel[0] : null;
    let dudosos = porTel;
    if (!elegido) {
      let porNombre = (porTel.length > 1 ? porTel : cands).filter((g) => mismoNombre(g.f.nombre, s.nombre));
      if (porNombre.length > 1) {
        // Si uno está escrito exactamente igual, es ese
        const iguales = porNombre.filter((g) => igualNombre(g.f.nombre, s.nombre));
        if (iguales.length === 1) porNombre = iguales;
      }
      if (porNombre.length > 1) {
        const libres = porNombre.filter((g) => g.cuotas.length === 0);
        if (libres.length === 1) porNombre = libres;
      }
      if (porNombre.length === 1) elegido = porNombre[0];
      else if (porNombre.length > 1) dudosos = porNombre;
    }
    if (elegido) elegido.cuotas.push(s);
    else {
      sueltas.push({ s: s, dudosos: dudosos });
      dudosos.forEach((g) => g.posibles.push(s.fila));
    }
  });

  // Compras repetidas (por ejemplo, alguien que mandó el formulario dos veces)
  grupos.forEach((a, i) => grupos.slice(i + 1).forEach((b) => {
    if (a.f.pago !== b.f.pago || claveEntradas(a.f.entradas) !== claveEntradas(b.f.entradas)) return;
    const ta = tel7(a.f.telefono);
    if ((ta && ta === tel7(b.f.telefono)) || igualNombre(a.f.nombre, b.f.nombre)) {
      a.repetida.push(b.f.fila);
      b.repetida.push(a.f.fila);
    }
  }));

  const salida = grupos.map((g) => {
    const f = g.f;
    const total = totalDe(f.entradas);
    const esperado = Object.keys(f.entradas).reduce((a, c) => a + (PRECIOS[c] || 0) * f.entradas[c], 0);
    const todas = [f].concat(g.cuotas);
    const pagado = todas.reduce((a, r) => a + (r.monto || (r.pago === 'Total' ? esperado : esperado / 2)), 0);
    const falta = Math.max(0, esperado - pagado);
    let estado = falta > 0 ? 'falta' : todas.every((r) => r.verificado) ? 'ok' : 'sinverificar';
    const notas = [];
    if (falta > 0 && g.posibles.length) {
      estado = 'revisar';
      notas.push('Puede que su 2ª cuota sea la fila ' + g.posibles.join(', ') + ' de Inscriptos.');
    }
    if (g.repetida.length) notas.push('¿Compra repetida? Mirá también la fila ' + g.repetida.join(', ') + '.');
    return {
      id: f.fila,
      nombre: f.nombre,
      quienes: f.quienes,
      tel: ultimos4(f.telefono),
      entradas: f.entradas,
      total: total,
      ingresaron: Math.min(f.ingresaron, total),
      estado: estado,
      falta: falta,
      filas: todas.map((r) => r.fila),
      nota: notas.join(' '),
    };
  });

  sueltas.forEach((x) => {
    const s = x.s;
    salida.push({
      id: 's' + s.fila,
      suelta: true,
      nombre: s.nombre,
      quienes: s.quienes,
      tel: ultimos4(s.telefono),
      entradas: s.entradas,
      total: 0,
      ingresaron: 0,
      estado: 'revisar',
      falta: 0,
      filas: [s.fila],
      nota: '2ª cuota sin unir a su 1ª cuota' +
        (x.dudosos.length ? ' (¿fila ' + x.dudosos.map((g) => g.f.fila).join(' o ') + '?)' : '') +
        '. Corregí el teléfono o el nombre en Inscriptos para que coincidan con la 1ª cuota.',
    });
  });

  const totales = salida.reduce((a, g) => ({ entradas: a.entradas + g.total, ingresaron: a.ingresaron + g.ingresaron }), { entradas: 0, ingresaron: 0 });
  return { grupos: salida, totales: totales };
}

function marcarIngreso(d) {
  if (!claveOk(d.clave)) return responder({ ok: false, error: 'clave' });
  const hoja = obtenerHoja();
  const col = columnaIngresaron(hoja);
  const fila = leerFilas(hoja).filter((f) => f.fila === Number(d.fila) && f.pago !== '2ª cuota')[0];
  if (!fila) return responder({ ok: false, error: 'cambio' });
  // Si alguien ordenó o borró filas, ese número ya es de otra persona: no se toca nada
  if (d.nombre && palabras(d.nombre).join(' ') !== palabras(fila.nombre).join(' ')) {
    return responder({ ok: false, error: 'cambio' });
  }

  // Cada toque tiene un id: si el celular reintenta por mala señal, no se cuenta dos veces
  const cache = CacheService.getScriptCache();
  const op = 'op_' + String(d.op || '').slice(0, 60);
  let actual = fila.ingresaron;
  if (!d.op || !cache.get(op)) {
    const delta = Math.max(-20, Math.min(20, Math.round(Number(d.delta) || 0)));
    actual = Math.max(0, Math.min(totalDe(fila.entradas), actual + delta));
    hoja.getRange(fila.fila, col).setValue(actual || '');
    if (d.op) cache.put(op, '1', 21600);
  }
  return responder({ ok: true, id: fila.fila, ingresaron: actual });
}

function totalDe(entradas) {
  return Object.keys(entradas).reduce((a, c) => a + (Number(entradas[c]) || 0), 0);
}

function claveEntradas(entradas) {
  return Object.keys(entradas).filter((c) => entradas[c] > 0).sort().map((c) => c + '×' + entradas[c]).join('|');
}

function tel7(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 7 ? d.slice(-7) : '';
}

function ultimos4(t) {
  const d = String(t || '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : '';
}

const PALABRAS_VACIAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];
function palabras(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter((p) => p && PALABRAS_VACIAS.indexOf(p) < 0);
}

function igualNombre(a, b) {
  const A = palabras(a);
  return A.length >= 2 && A.join(' ') === palabras(b).join(' ');
}

function mismoNombre(a, b) {
  const A = palabras(a);
  const B = palabras(b);
  const corto = A.length <= B.length ? A : B;
  const largo = A.length <= B.length ? B : A;
  return corto.length >= 2 && corto.every((p) => largo.indexOf(p) >= 0);
}
