#!/usr/bin/env node

import merge from 'lodash/merge.js';

import getLogger, { getLogLevel } from '../get-logger.mjs';
import runPackageScript from '../index.mjs';
import parse from '../bin-utils/parser.mjs';

const FAIL_CODE = 1;
const { argv, psConfig } = (await parse(process.argv.slice(2))) || {};

if (argv && psConfig) {
	runPackageScript({
		scriptConfig: psConfig.scripts,
		scripts: argv._,
		options: merge(psConfig.options, {
			silent: argv.silent,
			logLevel: argv.logLevel,
			scripts: argv.scripts
		})
	}).then(
		() => {
			// make this explicit
			// because sometimes we can't explain
			// everything about life that confuses us...
			process.exitCode = 0;
		},
		error => {
			const logLevel = getLogLevel({
				silent: argv.silent,
				logLevel: argv.logLevel,
				scripts: argv.scripts
			});
			const log = getLogger(logLevel);
			log.error(error);
			process.exitCode = error.code || FAIL_CODE;
		}
	);
}
