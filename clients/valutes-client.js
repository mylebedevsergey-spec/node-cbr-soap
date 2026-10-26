#!/usr/bin/env node

const { envelope, call, findAll, findOne, toNumber } = require('../lib/soap');

const PROXY_URL = process.argv[2] || process.env.PROXY_URL || 'http://127.0.0.1:4000/wsdl';

async function main() {
  const xml = envelope('urn:cbr-proxy', 'getValutes', {});
  const response = await call(PROXY_URL, 'urn:cbr-proxy#getValutes', xml);
  const rows = findAll(response, 'valutes').map((row) => ({
    Code: (findOne(row, 'Code') || '').trim(),
    Name: (findOne(row, 'Name') || '').trim(),
    Value: toNumber(findOne(row, 'Value')),
  }));

  console.log('Код   Название                      Курс, руб.');
  console.log('----  ----------------------------  --------');
  for (const row of rows) {
    console.log(`${row.Code.padEnd(5)} ${row.Name.slice(0, 28).padEnd(28)}  ${row.Value.toFixed(4)}`);
  }
  console.log('\nJSON:');
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error('Ошибка клиента getValutes:', error.message);
  process.exit(1);
});
