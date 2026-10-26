# SOAP-прокси и клиенты курсов валют ЦБ РФ

Учебное задание по Node.js: два SOAP-клиента, SOAP-сервер-прокси и SOAP-сервер ЦБ РФ.

## Схема из задания

```
SOAP-клиент (пользователь)  <-->  SOAP-сервер / SOAP-клиент (прокси)  <-->  SOAP-сервер (ЦБ РФ)
```

- **Пользовательский клиент** вызывает `getValutes` и `getValute` у прокси.
- **Прокси**, одновременно SOAP-сервер (для клиента) и SOAP-клиент (для ЦБ): запросы `getValutes`
  превращает в `GetCursOnDateXML`, а `getValute(code, dateFrom, dateTo)`, в `GetCursDynamicXML`.
- **ЦБ** отдаёт XML, прокси нормализует его в JSON-структуры: `[{ Code, Name, Value }]`
  и `[{ Date, Value }]` (курс приводится к цене за 1 единицу валюты).

## Состав

```
lib/soap.js            минимальный SOAP 1.1 клиент (fetch + сборка конверта + разбор ответа)
proxy/server.js        SOAP-прокси: getValutes, getValute, ЦБ РФ
clients/valutes-client.js  клиент: список валют с курсами
clients/valute-client.js   клиент: динамика курса валюты за период
mock-cbr/server.js     мок-сервер ЦБ: GetCursOnDateXML, EnumValutesXML, GetCursDynamicXML
test/e2e.js            сквозной тест: мок ЦБ, прокси, клиент + негативный сценарий
```

Внешних зависимостей нет, только стандартный `node:http` и `fetch`.

## Запуск

Против реального ЦБ (нужен доступ в интернет к `cbr.ru`):

```bash
node proxy/server.js                       # http://127.0.0.1:4000
node clients/valutes-client.js             # список валют
node clients/valute-client.js USD 2026-03-01 2026-03-05
```

Без интернета, через мок ЦБ:

```bash
node mock-cbr/server.js 4010 &
CBR_URL=http://127.0.0.1:4010/DailyInfoWebServ/DailyInfo.asmx node proxy/server.js &
node clients/valutes-client.js
node clients/valute-client.js USD 2026-03-01 2026-03-05
```

Автотест (сам поднимает мок и прокси):

```bash
node test/e2e.js
```

## Переменные окружения

| Переменная | Значение по умолчанию | Назначение |
|---|---|---|
| `PORT` | `4000` | порт прокси |
| `CBR_URL` | `https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx` | endpoint ЦБ |
| `PROXY_URL` | `http://127.0.0.1:4000/wsdl` | адрес прокси для клиентов |

## Протокол

Запрос клиента:

```xml
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:cbr-proxy">
  <soap:Body>
    <tns:getValute><code>USD</code><dateFrom>2026-03-01</dateFrom><dateTo>2026-03-05</dateTo></tns:getValute>
  </soap:Body>
</soap:Envelope>
```

Ответ прокси:

```xml
<getValuteResponse xmlns="urn:cbr-proxy">
  <values><Date>2026-03-01</Date><Value>92.74</Value></values>
  ...
</getValuteResponse>
```

Ошибки возвращаются как `soap:Fault` с текстом причины (например, пустой код валюты).

## Результат проверки

```
✔ getValutes: 4 валют, первая USD = 92.4512
✔ getValute: 5 точек динамики USD
✔ пустой код отклонён: SOAP 500 ... параметр code обязателен
E2E пройден: мок ЦБ, прокси, клиент.
```
