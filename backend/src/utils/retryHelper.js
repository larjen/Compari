/**
 * @module retryHelper
 * @description Provides staggered retry logic (Exponential Backoff-style) to handle temporary service outages (e.g., Ollama restarts).
 */
const { LOG_LEVELS: { ERROR, WARN }, LOG_SYMBOLS } = require('../config/constants');
const LogService = require('../services/LogService');

/**
 * Executes an async function with staggered retries.
 * @param {Function} asyncFn - The async function to execute.
 * @param {Array<number>} delays - Array of delay intervals in milliseconds.
 * @param {string} contextName - The name of the operation for logging.
 * @param {Function} [onRetry] - Optional callback fired when a retry is queued: (error, currentAttempt, maxAttempts, delaySec) => void
 * @returns {Promise<any>}
 */
async function withStaggeredRetry(asyncFn, delays = [5000, 10000, 30000], contextName = 'Operation', onRetry = null) {
    let attempt = 0;
    while (attempt <= delays.length) {
        try {
            return await asyncFn();
        } catch (error) {
            if (attempt === delays.length) {
                throw error;
            }

            const delayMs = delays[attempt];
            const delaySec = delayMs / 1000;

            if (error.isConnectionError) {
                LogService.logTerminal(WARN, LOG_SYMBOLS.WARNING, 'RetryHelper', `Retrying due to lost connection in ${delaySec}s`);
            } else {
                LogService.logTerminal(WARN, LOG_SYMBOLS.WARNING, 'RetryHelper', `${contextName} failed. Retrying in ${delaySec}s...`);
            }

            if (onRetry) {
                try {
                    onRetry(error, attempt + 1, delays.length, delaySec);
                } catch (cbErr) {
                    LogService.logTerminal(ERROR, LOG_SYMBOLS.ERROR, 'RetryHelper', `onRetry callback failed: ${cbErr.message}`);
                }
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
            attempt++;
        }
    }
}

module.exports = { withStaggeredRetry };