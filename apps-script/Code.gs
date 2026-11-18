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
  'Quiénes van', 'Comentarios', 'Pago verificado',
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

    hoja.appendRow([
      new Date(),
      seguro(d.nombre),
      seguro(d.telefono || ''),
      ['Total', '1ª cuota', '2ª cuota'].indexOf(d.pago) >= 0 ? d.pago : 'Total',
      ...entradas.map((n) => n || ''),
      totalEntradas,
      Number(d.monto) || '',
      seguro(d.titular),
      '',
      '',
      seguro(d.asistentes || ''),
      seguro(d.comentarios || ''),
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
function doGet() {
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
