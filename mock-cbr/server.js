

const http = require('node:http');
const { findOne, toNumber, escapeXml } = require('../lib/soap');

const PORT = Number(process.argv[2] || 4010);
const NAMESPACE = 'urn:mock-cbr';

const CURRENCIES = [
  { code: 840, char: 'USD', name: 'Доллар США', eng: 'US Dollar', nom: 1, value: 92.4512 },
  { code: 978, char: 'EUR', name: 'Евро', eng: 'Euro', nom: 1, value: 99.8734 },
  { code: 156, char: 'CNY', name: 'Китайский юань', eng: 'Chinese Yuan', nom: 1, value: 12.7912 },
  { code: 392, char: 'JPY', name: 'Японская иена', eng: 'Japanese Yen', nom: 100, value: 61.2345 },
  { code: 1000, char: 'KZT', name: 'Казахстанский тенге', eng: 'Kazakhstani Tenge', nom: 100, value: 19.3456 },
];

function soapResponse(operation, payload) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${operation}Response xmlns="${NAMESPACE}">
      ${payload}
    </${operation}Response>
  </soap:Body>
</soap:Envelope>`;
}

function valuteCursOnDate() {
  const rows = CURRENCIES.map((c) => `
      <ValuteCursOnDate>
        <Vname>${escapeXml(c.name)}</Vname>
        <Vnom>${c.nom}</Vnom>
        <Vcurs>${c.value}</Vcurs>
        <Vcode>${c.code}</Vcode>
        <VchCode>${c.char}</VchCode>
      </ValuteCursOnDate>`).join('');
  return `<ValuteData>${rows}</ValuteData>`;
}

function valuteEnum() {
  const rows = CURRENCIES.map((c) => `
      <ValuteEnum>
        <Vcode>${c.code}</Vcode>
        <Vname>${escapeXml(c.name)}</Vname>
        <VEngName>${escapeXml(c.eng)}</VEngName>
        <Vnom>${c.nom}</Vnom>
        <VcharCode>${c.char}</VcharCode>
      </ValuteEnum>`).join('');
  return `<ValuteData>${rows}</ValuteData>`;
}

function valuteDynamic(code) {
  const currency = CURRENCIES.find((c) => c.code === Number(code) || c.char === String(code).toUpperCase());
  if (!currency) {
    return '<ValuteData></ValuteData>';
  }
  const rows = [];
  for (let day = 1; day <= 5; day += 1) {
    const curs = (currency.value + Math.sin(day) * 0.35).toFixed(4);
    rows.push(`
      <ValuteCursDynamic>
        <CursDate>2026-03-0${day}T00:00:00+03:00</CursDate>
        <Vcurs>${curs}</Vcurs>
        <Vcode>${currency.code}</Vcode>
        <Vnom>${currency.nom}</Vnom>
      </ValuteCursDynamic>`);
  }
  return `<ValuteData>${rows.join('')}</ValuteData>`;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('mock CBR: только POST на /DailyInfoWebServ/DailyInfo.asmx');
    return;
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    let operation = '';
    let payload = '';

    if (/GetCursOnDateXML/i.test(body)) {
      operation = 'GetCursOnDateXML';
      payload = valuteCursOnDate();
    } else if (/EnumValutesXML/i.test(body)) {
      operation = 'EnumValutesXML';
      payload = valuteEnum();
    } else if (/GetCursDynamicXML/i.test(body)) {
      operation = 'GetCursDynamicXML';
      const code = findOne(body, 'ValutaCode') || findOne(body, 'ValutaCode');
      payload = valuteDynamic(code);
    } else {
      res.writeHead(500, { 'content-type': 'text/xml; charset=utf-8' });
      res.end(`<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault><faultcode>Client</faultcode><faultstring>Unknown operation</faultstring></soap:Fault></soap:Body></soap:Envelope>`);
      return;
    }

    res.writeHead(200, { 'content-type': 'text/xml; charset=utf-8' });
    res.end(soapResponse(operation, payload));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock CBR: http://127.0.0.1:${PORT}/DailyInfoWebServ/DailyInfo.asmx`);
});
