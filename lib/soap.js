/** Экранирование значений для XML. */
function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Собирает SOAP-конверт с одним вызовом операции. */
function envelope(namespace, operation, params = {}, headerXml = '') {
  const body = Object.entries(params)
    .map(([key, value]) => `<${key}>${escapeXml(value)}</${key}>`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${namespace}">
  <soap:Header>${headerXml}</soap:Header>
  <soap:Body>
    <tns:${operation}>${body}</tns:${operation}>
  </soap:Body>
</soap:Envelope>`;
}

async function call(url, action, xml, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        soapaction: `"${action}"`,
      },
      body: xml,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`SOAP ${response.status}: ${text.slice(0, 200)}`);
    }
    const fault = text.match(/<faultstring[^>]*>([\s\S]*?)<\/faultstring>/i);
    if (fault) {
      throw new Error(`SOAP Fault: ${fault[1]}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Достаёт все фрагменты по имени тега (без учёта namespace-префикса). */
function findAll(xml, tag) {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi');
  const result = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result.push(match[1]);
  }
  return result;
}

/** Достаёт первое значение тега. */
function findOne(xml, tag) {
  const values = findAll(xml, tag);
  return values.length ? values[0] : null;
}

/** Читает числовое значение из строки XML (в т.ч. с запятой как разделителем). */
function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = { envelope, call, findAll, findOne, toNumber, escapeXml };
