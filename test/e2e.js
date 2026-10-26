#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');
const { envelope, call, findAll, findOne, toNumber } = require('../lib/soap');

const ROOT = path.join(__dirname, '..');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function start(script, args, env) {
  const child = spawn(process.execPath, [path.join(ROOT, script), ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`  [${script}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`  [${script}] ${chunk}`));
  return child;
}

async function main() {
  const mock = start('mock-cbr/server.js', ['4010'], {});
  await wait(700);
  const proxy = start('proxy/server.js', [], { PORT: '4000', CBR_URL: 'http://127.0.0.1:4010/DailyInfoWebServ/DailyInfo.asmx' });
  await wait(900);

  let failures = 0;
  try {
    const url = 'http://127.0.0.1:4000/wsdl';

    const valutesXml = await call(url, 'urn:cbr-proxy#getValutes', envelope('urn:cbr-proxy', 'getValutes', {}));
    const valutes = findAll(valutesXml, 'valutes').map((row) => ({
      Code: (findOne(row, 'Code') || '').trim(),
      Value: toNumber(findOne(row, 'Value')),
    }));
    console.log(`✔ getValutes: ${valutes.length} валют, первая ${valutes[0] && valutes[0].Code} = ${valutes[0] && valutes[0].Value}`);
    if (valutes.length !== 5) { failures += 1; console.error('✖ ожидалось 5 валют'); }

    const dynXml = await call(url, 'urn:cbr-proxy#getValute', envelope('urn:cbr-proxy', 'getValute', { code: 'USD', dateFrom: '2026-03-01', dateTo: '2026-03-05' }));
    const points = findAll(dynXml, 'values');
    console.log(`✔ getValute: ${points.length} точек динамики USD`);
    if (points.length !== 5) { failures += 1; console.error('✖ ожидалось 5 точек'); }

    try {
      await call(url, 'urn:cbr-proxy#getValute', envelope('urn:cbr-proxy', 'getValute', { code: '', dateFrom: '2026-03-01', dateTo: '2026-03-05' }));
      failures += 1;
      console.error('✖ пустой код не вызвал ошибку');
    } catch (error) {
      console.log('✔ пустой код отклонён:', error.message.slice(0, 80));
    }
  } finally {
    proxy.kill('SIGTERM');
    mock.kill('SIGTERM');
  }

  if (failures) {
    console.error(`\nE2E провален, ошибок: ${failures}`);
    process.exit(1);
  }
  console.log('\nE2E пройден: мок ЦБ, прокси, клиент.');
}

main().catch((error) => {
  console.error('E2E упал:', error);
  process.exit(1);
});
