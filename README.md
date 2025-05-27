# express-dynamic-logger

Minimal middleware for Node.js/Express to provide dynamic, configurable logging with both automatic request/response logs and manual developer logs.

---

## 📦 Installation

```bash
npm install express-dynamic-logger
```

Or with Yarn:

```bash
yarn add express-dynamic-logger
```

---

## 🚀 Usage

Import and mount the logger factory:

```js
const express = require('express');
const app = express();

const logger = require('express-dynamic-logger');
app.use(logger());       // default options
```

To pass custom options:

```js
const logger = require('express-dynamic-logger');
app.use(logger({
  logPrefix: '[APP]',
  printAutoLogs: true,
  printManualLogs: true,
  // ...other options...
}));
```

---

## ⚙️ Configuration Options

| Option                    | Type       | Default                       | Description                                                                                      |
|---------------------------|------------|-------------------------------|--------------------------------------------------------------------------------------------------|
| `level`                   | `string`   | `'info'`                      | Log level for automatic logs (`[INI]`, `[END]`).                                   |
| `printAutoLogs`           | `boolean`  | `true`                        | Whether to print automatic logs.                                                                 |
| `printManualLogs`         | `boolean`  | `true`                        | Whether to print developer-invoked logs (`req.log.*`).                                          |
| `requestIdHeader`         | `string`   | `'x-request-id'`              | Header name used to propagate or generate a request ID.                                          |
| `autoGenerateRequestId`   | `boolean`  | `true`                        | Generate a UUID request ID if the header is missing.                                             |
| `skipPaths`               | `string[]` | `['/health','/favicon.ico']`  | Array of routes to ignore (no logging).                                                         |
| `deepHeaders`             | `boolean`  | `true`                        | Include all headers; if `false`, filter out common browser headers.                              |
| `redact`                  | `string[]` | `['authorization']`           | List of header names to mask with `****`.                                                  |
| `logPrefix`               | `string`   | `''`                          | Global prefix prepended to every log entry.                                                      |
| `statusPrefix100`         | `string`   | `''`                          | Prefix for 1xx HTTP status logs.                                                                 |
| `statusPrefix200`         | `string`   | `''`                          | Prefix for 2xx HTTP status logs.                                                                 |
| `statusPrefix300`         | `string`   | `''`                          | Prefix for 3xx HTTP status logs.                                                                 |
| `statusPrefix400`         | `string`   | `''`                          | Prefix for 4xx HTTP status logs.                                                                 |
| `statusPrefix500`         | `string`   | `''`                          | Prefix for 5xx HTTP status logs.                                                                 |
| `levelPrefixDebug`        | `string`   | `''`                          | Prefix for `req.log.debug` messages.                                                             |
| `levelPrefixInfo`         | `string`   | `''`                          | Prefix for `req.log.info` messages.                                                              |
| `levelPrefixWarn`         | `string`   | `''`                          | Prefix for `req.log.warn` messages.                                                              |
| `levelPrefixError`        | `string`   | `''`                          | Prefix for `req.log.error` messages.                                                             |
| `levelPrefixFatal`        | `string`   | `''`                          | Prefix for `req.log.fatal` messages.                                                             |

---

## ✨ Examples

### Default Behavior

```js
app.use(logger());
app.get('/ping', (req, res) => {
  req.log.info('Ping handler');
  res.send('pong');
});
```

### Disable Auto-Logs

```js
app.use(logger({ printAutoLogs: false }));
```

### Disable Manual Logs

```js
app.use(logger({ printManualLogs: false }));
```

### Skip Paths and Custom Request ID

```js
app.use(logger({
  skipPaths: ['/health'],
  requestIdHeader: 'x-custom-id',
  autoGenerateRequestId: false
}));
```

### Filter and Redact Headers

```js
app.use(logger({
  deepHeaders: false,
  redact: ['authorization', 'cookie']
}));
```

### Custom HTTP Status Prefixes

```js
app.use(logger({
  statusPrefix200: '[OK]',
  statusPrefix400: '[BAD_REQ]',
  statusPrefix500: '[ERR]'
}));
```

### Prefix Configuration Only

```js
app.use(logger({
  logPrefix: '[APP]',
  statusPrefix200: '[SUCCESS]',
  statusPrefix400: '[CLIENT_ERR]',
  statusPrefix500: '[SERVER_ERR]',
  levelPrefixDebug: '🐛',
  levelPrefixInfo: 'ℹ️',
  levelPrefixWarn: '⚠️',
  levelPrefixError: '❌',
  levelPrefixFatal: '💀'
}));
```

---

## 🚧 Error Resilience

All logging logic runs inside a single `try/catch`, so internal errors will be printed via `console.error` without interrupting the server.

---

## 📄 License

This project is open source under the [MIT License](https://opensource.org/licenses/MIT).
