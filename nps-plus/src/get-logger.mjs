import console from 'console';
import arrify from 'arrify';
import { oneLineTrim } from 'common-tags';
import includes from 'lodash/includes.js';
import isPlainObject from 'lodash/isPlainObject.js';

import { createRequire } from 'module';
const packageJson = createRequire(import.meta.url)('../package.json');

// const { version } = require('../package.json');
// import packageJson from '../package.json' assert { type: 'json' };
const { version } = packageJson;

const shouldLog = {
	// fn called         logLevels
	info: getShouldLogFn('', 'debug', 'info'),
	warn: getShouldLogFn('', 'debug', 'info', 'warn'),
	error: getShouldLogFn('', 'debug', 'info', 'warn', 'error')
};

export default getLogger;
export { getLogLevel };

function getLogger(logLevel) {
	return {
		error: getLogFn('error'),
		warn: getLogFn('warn'),
		info: getLogFn('info')
	};

	function getLogFn(name) {
		return function logFn(...args) {
			if (shouldLog[name](process.env.LOG_LEVEL || logLevel)) {
				const message = getMessage(...args);
				console[name](...message);
			}
		};
	}
}

function getMessage(first, ...rest) {
	if (isPlainObject(first) && first.message && first.ref) {
		return [...arrify(first.message), getLink(first.ref), first.error, ...rest].filter(i => !!i);
	} else {
		return [first, ...rest];
	}
}

function getLink(ref) {
	return oneLineTrim`
    https://github.com/mehuge/nps-plus/blob/v
    ${version}
    /other/ERRORS_AND_WARNINGS.md#
    ${ref}
  `;
}

function getShouldLogFn(...acceptableValues) {
	return function shouldLogWithLevel(logLevel = '') {
		logLevel = logLevel.toLowerCase();
		return !logLevel || includes(acceptableValues, logLevel);
	};
}

function getLogLevel({ silent, logLevel }) {
	return silent ? 'disable' : logLevel;
}
