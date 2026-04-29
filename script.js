const elements = {
  csvFile: document.getElementById('csvFile'),
  hasHeaders: document.getElementById('hasHeaders'),
  delimiter: document.getElementById('delimiter'),
  dataColumn: document.getElementById('dataColumn'),
  labelColumn: document.getElementById('labelColumn'),
  qrSize: document.getElementById('qrSize'),
  qrMargin: document.getElementById('qrMargin'),
  generateButton: document.getElementById('generateButton'),
  downloadAllButton: document.getElementById('downloadAllButton'),
  clearButton: document.getElementById('clearButton'),
  status: document.getElementById('status'),
  summary: document.getElementById('summary'),
  results: document.getElementById('results')
};

const state = {
  rawCsv: '',
  delimiter: '',
  headers: [],
  rows: [],
  generatedItems: []
};

function setStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.className = 'status';
  if (type === 'error') {
    elements.status.classList.add('error');
  } else if (type === 'success') {
    elements.status.classList.add('success');
  }
}

function escapeCsvValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim().length > 0) || '';
  const candidates = [',', ';', '\t', '|'];
  const detected = candidates
    .map(candidate => ({ candidate, count: firstLine.split(candidate).length - 1 }))
    .sort((a, b) => b.count - a.count)[0];

  return detected && detected.count > 0 ? detected.candidate : ',';
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let value = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (current === '"') {
      if (insideQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (!insideQuotes && current === delimiter) {
      row.push(value);
      value = '';
      continue;
    }

    if (!insideQuotes && (current === '\n' || current === '\r')) {
      if (current === '\r' && next === '\n') {
        index += 1;
      }
      row.push(value);
      if (row.some(cell => cell.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      value = '';
      continue;
    }

    value += current;
  }

  row.push(value);
  if (row.some(cell => cell.trim() !== '')) {
    rows.push(row);
  }

  return rows;
}

function buildTableData() {
  if (!state.rawCsv) {
    return;
  }

  state.delimiter = detectDelimiter(state.rawCsv);
  elements.delimiter.value = state.delimiter === '\t' ? 'tab' : state.delimiter;

  const rawRows = parseCsv(state.rawCsv, state.delimiter);
  if (!rawRows.length) {
    state.headers = [];
    state.rows = [];
    syncColumnSelectors();
    elements.generateButton.disabled = true;
    setStatus('El CSV está vacío o no contiene filas válidas.', 'error');
    return;
  }

  const hasHeaders = elements.hasHeaders.checked;
  const headerRow = hasHeaders ? rawRows[0] : rawRows[0].map((_, index) => `Columna ${index + 1}`);
  const dataRows = hasHeaders ? rawRows.slice(1) : rawRows;

  state.headers = headerRow.map((header, index) => {
    const normalized = escapeCsvValue(header);
    return normalized || `Columna ${index + 1}`;
  });

  state.rows = dataRows.map((row, rowIndex) => {
    const normalizedRow = {};
    state.headers.forEach((header, columnIndex) => {
      normalizedRow[header] = escapeCsvValue(row[columnIndex] || '');
    });
    normalizedRow.__rowNumber = rowIndex + 1;
    return normalizedRow;
  });

  syncColumnSelectors();

  if (!state.rows.length) {
    setStatus('El archivo solo contiene encabezados. Agrega filas con datos para generar QRs.', 'error');
    elements.generateButton.disabled = true;
    return;
  }

  elements.generateButton.disabled = false;
  setStatus(`CSV cargado correctamente: ${state.rows.length} filas detectadas.`, 'success');
}

function syncColumnSelectors() {
  elements.dataColumn.replaceChildren();
  elements.labelColumn.replaceChildren();

  const defaultDataOption = document.createElement('option');
  defaultDataOption.value = '';
  defaultDataOption.textContent = 'Primero carga un CSV';

  const defaultLabelOption = document.createElement('option');
  defaultLabelOption.value = '';
  defaultLabelOption.textContent = 'Usar el mismo valor del QR';

  elements.dataColumn.appendChild(defaultDataOption);
  elements.labelColumn.appendChild(defaultLabelOption);

  state.headers.forEach(header => {
    const dataOption = document.createElement('option');
    dataOption.value = header;
    dataOption.textContent = header;

    const labelOption = document.createElement('option');
    labelOption.value = header;
    labelOption.textContent = header;

    elements.dataColumn.appendChild(dataOption);
    elements.labelColumn.appendChild(labelOption);
  });

  const disabled = state.headers.length === 0;
  elements.dataColumn.disabled = disabled;
  elements.labelColumn.disabled = disabled;

  if (!disabled) {
    elements.dataColumn.value = state.headers[0];
    elements.labelColumn.value = state.headers[1] || '';
  } else {
    elements.dataColumn.value = '';
    elements.labelColumn.value = '';
  }
}

function slugify(value, fallback) {
  const normalized = value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return normalized || fallback;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('No se pudo generar la imagen PNG.'));
      }
    }, 'image/png');
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderQrCard(item, size, margin) {
  const card = document.createElement('article');
  card.className = 'qr-card';

  const meta = document.createElement('div');
  meta.className = 'qr-meta';

  const title = document.createElement('p');
  title.className = 'qr-title';
  title.textContent = item.label;

  const value = document.createElement('p');
  value.className = 'qr-value';
  value.textContent = item.value;

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'qr-canvas-wrap';

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'download-button';
  button.textContent = 'Descargar PNG';

  meta.append(title, value);
  canvasWrap.appendChild(canvas);
  card.append(meta, canvasWrap, button);

  await window.QRCode.toCanvas(canvas, item.value, {
    width: size,
    margin,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#111827',
      light: '#ffffff'
    }
  });

  const filename = `${slugify(item.label, `qr-${item.index}`)}.png`;
  button.addEventListener('click', async () => {
    const blob = await canvasToBlob(canvas);
    downloadBlob(blob, filename);
  });

  return {
    element: card,
    canvas,
    filename
  };
}

async function generateQrs() {
  if (!window.QRCode || !window.JSZip) {
    setStatus('No se cargaron las librerías necesarias para generar o exportar QRs.', 'error');
    return;
  }

  const selectedColumn = elements.dataColumn.value;
  const labelColumn = elements.labelColumn.value;
  const size = Number.parseInt(elements.qrSize.value, 10);
  const margin = Number.parseInt(elements.qrMargin.value, 10);

  if (!selectedColumn) {
    setStatus('Selecciona la columna que contiene el dato para el QR.', 'error');
    return;
  }

  if (!Number.isFinite(size) || size < 80 || size > 1200) {
    setStatus('El tamaño debe estar entre 80 y 1200 px.', 'error');
    return;
  }

  if (!Number.isFinite(margin) || margin < 0 || margin > 10) {
    setStatus('El margen debe estar entre 0 y 10.', 'error');
    return;
  }

  const items = state.rows
    .map((row, index) => {
      const value = escapeCsvValue(row[selectedColumn]);
      const rawLabel = labelColumn ? row[labelColumn] : value;
      const label = escapeCsvValue(rawLabel) || `Elemento ${index + 1}`;
      return {
        index: index + 1,
        label,
        value
      };
    })
    .filter(item => item.value);

  if (!items.length) {
    setStatus('No hay valores válidos en la columna seleccionada.', 'error');
    return;
  }

  elements.results.innerHTML = '';
  elements.results.classList.remove('empty');
  elements.generateButton.disabled = true;
  elements.downloadAllButton.disabled = true;
  elements.clearButton.disabled = true;
  setStatus('Generando códigos QR...', 'info');

  try {
    const renderedItems = [];
    for (const item of items) {
      const rendered = await renderQrCard(item, size, margin);
      elements.results.appendChild(rendered.element);
      renderedItems.push({ ...item, ...rendered });
    }

    state.generatedItems = renderedItems;
    elements.summary.textContent = `${renderedItems.length} QR(s) listos. Tamaño configurado: ${size}px.`;
    elements.downloadAllButton.disabled = false;
    elements.clearButton.disabled = false;
    setStatus('QRs generados correctamente. Ya puedes descargarlos.', 'success');
  } catch (error) {
    console.error(error);
    state.generatedItems = [];
    elements.results.innerHTML = '<p>No se pudieron generar los QRs.</p>';
    elements.results.classList.add('empty');
    elements.summary.textContent = 'Ocurrió un problema al generar la vista previa.';
    setStatus('Ocurrió un error al generar los QRs. Revisa el archivo y vuelve a intentar.', 'error');
  } finally {
    elements.generateButton.disabled = false;
  }
}

async function downloadAll() {
  if (!state.generatedItems.length) {
    setStatus('Primero genera los QRs que quieres exportar.', 'error');
    return;
  }

  elements.downloadAllButton.disabled = true;
  setStatus('Preparando archivo ZIP...', 'info');

  try {
    const zip = new window.JSZip();
    for (const item of state.generatedItems) {
      const blob = await canvasToBlob(item.canvas);
      zip.file(item.filename, blob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    downloadBlob(content, `qrs-${timestamp}.zip`);
    setStatus('ZIP generado correctamente.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No fue posible exportar el ZIP.', 'error');
  } finally {
    elements.downloadAllButton.disabled = false;
  }
}

function clearResults() {
  state.generatedItems = [];
  elements.results.innerHTML = '<p>No hay QRs generados todavía.</p>';
  elements.results.className = 'results empty';
  elements.summary.textContent = 'Aún no hay elementos generados.';
  elements.downloadAllButton.disabled = true;
  elements.clearButton.disabled = true;
  setStatus(state.rows.length ? 'Resultados limpiados. Puedes volver a generar con otra configuración.' : 'Sube un CSV para comenzar.');
}

async function readSelectedFile(file) {
  const text = await file.text();
  state.rawCsv = text;
  clearResults();
  buildTableData();
}

elements.csvFile.addEventListener('change', async event => {
  const [file] = event.target.files || [];
  if (!file) {
    state.rawCsv = '';
    state.delimiter = '';
    state.headers = [];
    state.rows = [];
    elements.delimiter.value = '-';
    elements.generateButton.disabled = true;
    syncColumnSelectors();
    clearResults();
    return;
  }

  try {
    await readSelectedFile(file);
  } catch (error) {
    console.error(error);
    setStatus('No se pudo leer el archivo seleccionado.', 'error');
  }
});

elements.hasHeaders.addEventListener('change', () => {
  if (!state.rawCsv) {
    return;
  }
  clearResults();
  buildTableData();
});

elements.generateButton.addEventListener('click', generateQrs);
elements.downloadAllButton.addEventListener('click', downloadAll);
elements.clearButton.addEventListener('click', clearResults);
