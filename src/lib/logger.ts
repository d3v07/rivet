/**
 * Structured logging utility using Winston
 * All logs are JSON-formatted with: timestamp, level, message, context, correlationId
 */

import winston from 'winston'
import { v4 as uuidv4 } from 'uuid'

const isDev = process.env.NODE_ENV !== 'production'

const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'rivet' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `${timestamp} [${level}] ${message} ${metaStr}`
        })
      ),
    }),
  ],
})

export function createCorrelationId(): string {
  return uuidv4()
}

export interface LogContext {
  correlationId: string
  [key: string]: unknown
}

export function logInfo(
  message: string,
  context: LogContext
): void {
  logger.info(message, { ...context })
}

export function logError(
  message: string,
  context: LogContext,
  error?: Error
): void {
  logger.error(message, {
    ...context,
    error: error ? error.message : undefined,
    stack: error ? error.stack : undefined,
  })
}

export function logWarn(
  message: string,
  context: LogContext
): void {
  logger.warn(message, { ...context })
}

export function logDebug(
  message: string,
  context: LogContext
): void {
  logger.debug(message, { ...context })
}

export default logger
