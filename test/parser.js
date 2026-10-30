// Проверка разбора SOAP-ответа на заранее подготовленном куске XML.
const assert = require('node:assert/strict');
const { envelope, findAll, findOne, toNumber, escapeXml } = require('../lib/soap');

const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCursOnDateXMLResponse xmlns="http://web.cbr.ru/">
      <GetCursOnDateXMLResult>
        <ValuteData>
          <ValuteCursOnDate><VchCode>USD</VchCode><Vnom>1</Vnom><Vcurs>92.4512</Vcurs></ValuteCursOnDate>
          <ValuteCursOnDate><VchCode>JPY</VchCode><Vnom>100</Vnom><Vcurs>61.2345</Vcurs></ValuteCursOnDate>
        </ValuteData>
      </GetCursOnDateXMLResult>
    </GetCursOnDateXMLResponse>
  </soap:Body>
</soap:Envelope>`;

const rows = findAll(xml, 'ValuteCursOnDate');
assert.equal(rows.length, 2);
assert.equal(findOne(rows[0], 'VchCode'), 'USD');
assert.equal(toNumber(findOne(rows[1], 'Vcurs')), 61.2345);
assert.equal(toNumber(findOne(rows[1], 'Vnom'), 1), 100);

const body = envelope('http://web.cbr.ru/', 'GetCursOnDateXML', { On_date: '26/10/2026' });
assert.ok(body.includes('GetCursOnDateXML'));
assert.ok(body.includes('26/10/2026'));
assert.equal(escapeXml('a & b < c'), 'a &amp; b &lt; c');

console.log('разбор SOAP: ок, проверено 7 утверждений');
