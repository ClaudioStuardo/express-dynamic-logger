/* express-dynamic-logger
   ----------------------
  Minimal middleware for Node.js/Express:
    - Auto logs incoming requests ([INI]) and outgoing responses ([END]) at INFO level by default
    - Allow manual logging via req.log (levels: debug, info, warn, error, fatal) with configurable prefixes per level
    - Log missing routes ([NOT_FOUND])
    - Single try/catch to ensure middleware never breaks server

  Configurable print behavior:
    printAutoLogs: whether to print auto-generated logs (INI, END, NOT_FOUND)
    printManualLogs: whether to print developer-invoked logs (req.log)

  Configurable prefixes:
    logPrefix: prefix for all logs
    statusPrefix100-500: prefix based on HTTP status category
    levelPrefixDebug: prefix for debug logs
    levelPrefixInfo: prefix for info logs
    levelPrefixWarn: prefix for warn logs
    levelPrefixError: prefix for error logs
    levelPrefixFatal: prefix for fatal logs

  Default usage (all on, default prefixes blank):
    const express = require('express');
    const app = express();
    const logger = require('express-dynamic-logger');
    app.use(logger());
*/

const { createLogger, format, transports } = require('winston');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_BROWSER_HEADERS = [
  'accept', 'accept-language', 'accept-encoding', 'connection',
  'host', 'user-agent', 'referer', 'origin', 'cookie',
  'upgrade-insecure-requests', 'sec-fetch-site', 'sec-fetch-mode',
  'sec-fetch-user', 'sec-fetch-dest', 'content-type', 'content-length',
  'cache-control', 'if-none-match', 'if-modified-since',
  'accept-ranges', 'pragma', 'expires', 'sec-ch-ua', 'sec-ch-ua-mobile',
  'sec-ch-ua-platform'
];

const defaultConfig = {
  level: 'info',            // log level for auto logs
  prettyPrint: true,
  skipPaths: ['/health', '/favicon.ico'],
  requestIdHeader: 'x-request-id',
  autoGenerateRequestId: true,
  redact: ['authorization'],
  deepHeaders: true,
  logPrefix: '',
  statusPrefix100: '',
  statusPrefix200: '',
  statusPrefix300: '',
  statusPrefix400: '',
  statusPrefix500: '',
  levelPrefixDebug: '',
  levelPrefixInfo: '',
  levelPrefixWarn: '',
  levelPrefixError: '',
  levelPrefixFatal: '',
  printAutoLogs: true,
  printManualLogs: true
};

function expressDynamicLogger(options = {}) {
  const cfg = { ...defaultConfig, ...options };

  // Auto logger with configured level
  const autoLogger = createLogger({
    level: cfg.level,
    format: cfg.prettyPrint
      ? format.combine(format.colorize(), format.simple())
      : format.json(),
    transports: [new transports.Console()],
    exitOnError: false
  });

  // Manual logger always at debug to ensure all levels print
  const manualLogger = createLogger({
    level: 'debug',
    format: cfg.prettyPrint
      ? format.combine(format.colorize(), format.simple())
      : format.json(),
    transports: [new transports.Console()],
    exitOnError: false
  });

  // Helper to build prefix string with spaces
  const buildPrefix = (...parts) => {
    const nonEmpty = parts.filter(p => p && p.length);
    return nonEmpty.length ? nonEmpty.join(' ') + '  ' : '';
  };

  return function (req, res, next) {
    try {
      if (cfg.skipPaths.includes(req.path)) return next();

      const start = Date.now();
      const rid = req.headers[cfg.requestIdHeader] || uuidv4();
      if (cfg.autoGenerateRequestId) res.setHeader(cfg.requestIdHeader, rid);

      // Manual logging helper: covers debug, info, warn, error, fatal
      req.log = {
        debug: (msg, meta = {}) => {
          if (!cfg.printManualLogs) return;
          const prefix = buildPrefix(cfg.logPrefix, cfg.levelPrefixDebug);
          manualLogger.debug(`${prefix}${msg}`, { requestId: rid, ...meta });
        },
        info: (msg, meta = {}) => {
          if (!cfg.printManualLogs) return;
          const prefix = buildPrefix(cfg.logPrefix, cfg.levelPrefixInfo);
          manualLogger.info(`${prefix}${msg}`, { requestId: rid, ...meta });
        },
        warn: (msg, meta = {}) => {
          if (!cfg.printManualLogs) return;
          const prefix = buildPrefix(cfg.logPrefix, cfg.levelPrefixWarn);
          manualLogger.warn(`${prefix}${msg}`, { requestId: rid, ...meta });
        },
        error: (msg, meta = {}) => {
          if (!cfg.printManualLogs) return;
          const prefix = buildPrefix(cfg.logPrefix, cfg.levelPrefixError);
          manualLogger.error(`${prefix}${msg}`, { requestId: rid, ...meta });
        },
        fatal: (msg, meta = {}) => {
          if (!cfg.printManualLogs) return;
          const prefix = buildPrefix(cfg.logPrefix, cfg.levelPrefixFatal);
          manualLogger.log('fatal', `${prefix}${msg}`, { requestId: rid, ...meta });
        }
      };

      // Prepare headers
      const headersToLog = cfg.deepHeaders
        ? { ...req.headers }
        : Object.fromEntries(
          Object.entries(req.headers)
            .filter(([k]) => !DEFAULT_BROWSER_HEADERS.includes(k.toLowerCase()))
        );
      cfg.redact.forEach(field => {
        const key = field.toLowerCase();
        if (headersToLog[key]) headersToLog[key] = '****';
      });

      // Auto-log incoming request
      if (cfg.printAutoLogs) {
        const prefix = buildPrefix(cfg.logPrefix, '[INI]');
        autoLogger.info(prefix, {
          requestId: rid,
          method: req.method,
          url: req.originalUrl,
          headers: headersToLog,
          query: req.query,
          params: req.params,
          body: req.body
        });
      }

      // Override res.send for single END log with parse
      const origSend = res.send;
      let hasLoggedEnd = false;
      res.send = function (body) {
        if (!hasLoggedEnd && cfg.printAutoLogs) {
          hasLoggedEnd = true;

          // Parse JSON string if possible
          let responseBody = body;
          if (typeof body === 'string') {
            try {
              responseBody = JSON.parse(body);
            } catch (e) {
              responseBody = body;
            }
          }

          const duration = `${Date.now() - start}ms`;
          const status = res.statusCode;
          const cat = Math.floor(status / 100) * 100;
          const statusPrefix = cfg[`statusPrefix${cat}`] || '';
          const msgPrefix = buildPrefix(cfg.logPrefix, '[END]', statusPrefix);

          autoLogger.info(msgPrefix, {
            requestId: rid,
            method: req.method,
            url: req.originalUrl,
            status,
            duration,
            response: responseBody
          });
        }
        return origSend.call(this, body);
      };

      // Handle missing routes (404)
      res.on('finish', () => {
        if (cfg.printAutoLogs && res.statusCode === 404) {
          const duration = `${Date.now() - start}ms`;
          const prefix = buildPrefix(cfg.logPrefix, '[NOT_FOUND]');
          autoLogger.error(prefix, {
            requestId: rid,
            method: req.method,
            url: req.originalUrl,
            status: 404,
            duration
          });
        }
      });

    } catch (error) {
      console.error('[express-dynamic-logger] Error:', error);
    }
    next();
  };
}

module.exports = expressDynamicLogger;
