

const http = require('node:http');
const { envelope, call, findAll, findOne, toNumber } = require('../lib/soap');

const PORT = Number(process.env.PORT || 4000);
const CBR_URL = process.env.CBR_URL || 'https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx';
const CBR_NS = 'http://web.cbr.ru/';
const NS = 'urn:cbr-proxy';

/** DD/MM/YYYY, формат, который понимает ЦБ. */
function toCbrDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

/** Запрос в ЦБ: справочник валют, нужен для названий и кодов. */
async function fetchValuteNames() {
  const xml = envelope(CBR_NS, 'EnumValutesXML', { Seld: false });
  const response = await call(CBR_URL, `${CBR_NS}EnumValutesXML`, xml);
  const names = new Map();
  for (const row of findAll(response, 'ValuteEnum')) {
    const code = (findOne(row, 'VcharCode') || findOne(row, 'Vcode') || '').trim();
    if (code) {
      names.set(code, (findOne(row, 'Vname') || '').trim());
    }
  }
  return names;
}

/** Запрос в ЦБ: список валют на дату. */
async function fetchValutes() {
  const names = await fetchValuteNames();
  const xml = envelope(CBR_NS, 'GetCursOnDateXML', { On_date: toCbrDate() });
  const response = await call(CBR_URL, `${CBR_NS}GetCursOnDateXML`, xml);
  return findAll(response, 'ValuteCursOnDate').map((row) => {
    const code = (findOne(row, 'VchCode') || '').trim();
    return {
      Code: code,
      Name: names.get(code) || (findOne(row, 'Vname') || '').trim(),
      Value: Number((toNumber(findOne(row, 'Vcurs')) / (toNumber(findOne(row, 'Vnom'), 1) || 1)).toFixed(4)),
    };
  });
}

/** Запрос в ЦБ: динамика курса валюты за период. */
async function fetchDynamics(code, dateFrom, dateTo) {
  const xml = envelope(CBR_NS, 'GetCursDynamicXML', {
    FromDate: toCbrDate(dateFrom),
    ToDate: toCbrDate(dateTo),
    ValutaCode: code,
  });
  const response = await call(CBR_URL, `${CBR_NS}GetCursDynamicXML`, xml);
  return findAll(response, 'ValuteCursDynamic').map((row) => ({
    Date: (findOne(row, 'CursDate') || '').slice(0, 10),
    Value: Number((toNumber(findOne(row, 'Vcurs')) / (toNumber(findOne(row, 'Vnom'), 1) || 1)).toFixed(4)),
  }));
}

function soapResponse(operation, payload) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operation}Response xmlns="${NS}">${payload}</${operation}Response>
  </soap:Body>
</soap:Envelope>`;
}

function fault(message) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body><soap:Fault><faultcode>Server</faultcode><faultstring>${String(message).replace(/[<>&]/g, '')}</faultstring></soap:Fault></soap:Body>
</soap:Envelope>`;
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ status: 'ok', cbr: CBR_URL, operations: ['getValutes', 'getValute'] }));
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      if (/getValutes\b/i.test(body)) {
        const valutes = await fetchValutes();
        const payload = valutes
          .map((v) => `<valutes><Code>${v.Code}</Code><Name>${v.Name}</Name><Value>${v.Value}</Value></valutes>`)
          .join('');
        res.writeHead(200, { 'content-type': 'text/xml; charset=utf-8' });
        res.end(soapResponse('getValutes', payload));
        return;
      }

      if (/getValute\b/i.test(body)) {
        const code = (findOne(body, 'code') || '').trim();
        if (!code) {
          throw new Error('параметр code обязателен (например, USD или 840)');
        }
        const values = await fetchDynamics(code, findOne(body, 'dateFrom'), findOne(body, 'dateTo'));
        const payload = values
          .map((v) => `<values><Date>${v.Date}</Date><Value>${v.Value}</Value></values>`)
          .join('');
        res.writeHead(200, { 'content-type': 'text/xml; charset=utf-8' });
        res.end(soapResponse('getValute', payload));
        return;
      }

      res.writeHead(500, { 'content-type': 'text/xml; charset=utf-8' });
      res.end(fault('unknown operation'));
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/xml; charset=utf-8' });
      res.end(fault(error.message));
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SOAP-прокси: http://127.0.0.1:${PORT}/wsdl (endpoint для клиентов)`);
  console.log(`Источник данных ЦБ: ${CBR_URL}`);
});
