#!/usr/bin/env node

const { envelope, call, findAll, findOne, toNumber } = require('../lib/soap');

const [, , codeArg, fromArg, toArg, urlArg] = process.argv;
const code = codeArg || 'USD';
const dateFrom = fromArg || '2026-03-01';
const dateTo = toArg || '2026-03-05';
const PROXY_URL = urlArg || process.env.PROXY_URL || 'http://127.0.0.1:4000/wsdl';

async function main() {
  const xml = envelope('urn:cbr-proxy', 'getValute', { code, dateFrom, dateTo });
  const response = await call(PROXY_URL, 'urn:cbr-proxy#getValute', xml);
  const rows = findAll(response, 'values').map((row) => ({
    Date: (findOne(row, 'Date') || '').trim(),
    Value: toNumber(findOne(row, 'Value')),
  }));

  console.log(`Динамика курса ${code} за ${dateFrom} … ${dateTo}`);
  console.log('Дата        Курс, руб.');
  console.log('----------  --------');
  for (const row of rows) {
    console.log(`${row.Date.padEnd(10)}  ${row.Value.toFixed(4)}`);
  }
  console.log('\nJSON:');
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error('Ошибка клиента getValute:', error.message);
  process.exit(1);
});
