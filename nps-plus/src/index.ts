import spawn from 'spawn-command-with-kill';
import chalk from 'chalk';
import { oneLine } from 'common-tags';
// import { isString, isFunction, clone } from 'lodash';
import isString from 'lodash/isString.js';
import isFunction from 'lodash/isFunction.js';
import clone from 'lodash/clone.js';
import { sync as findUpSync } from 'find-up';
import managePath from 'manage-path';
import arrify from 'arrify';
import getScriptToRun from './get-script-to-run.mjs';
import getScriptsFromConfig from './get-scripts-from-config.mjs';
import getLogger, { getLogLevel } from './get-logger.mjs';
// import { access } from 'fs';

const NON_ERROR = 0;

export default runPackageScripts;

function runPackageScripts({ scriptConfig, scripts, options = {} }) {
	if (scripts.length === 0) {
		scripts = ['default'];
	}
	let scriptNames = arrify(scripts).reduce((a, c) => (a.push(...c.split(',')), a), []);

	const separatorIndex = scriptNames.indexOf('--');
	if (separatorIndex >= 0) {
		const additionalOptions = scriptNames.slice(separatorIndex + 1).join(' ');
		if (separatorIndex === 0) {
			scriptNames = [`default ${additionalOptions}`];
		} else {
			scriptNames.splice(separatorIndex);
			const lastIndex = scriptNames.length - 1;
			scriptNames[lastIndex] = `${scriptNames[lastIndex]} ${additionalOptions}`;
		}
	}

	return scriptNames.reduce((res, input) => {
		return res.then(() => runPackageScript({ scriptConfig, options, input }));
	}, Promise.resolve());
}

function runPackageScript({ scriptConfig, options, input }) {
	const [scriptPrefix, ...args] = input.split(' ');
	const scripts = getScriptsFromConfig(scriptConfig, scriptPrefix);
	let { scriptName, script } = getScriptToRun(scripts, scriptPrefix) || {};
	const log = getLogger(getLogLevel(options));

	// function as script
	if (isFunction(script)) {
		log.info(`${chalk.gray('nps is calling')} ${chalk.bold(scriptName)}()`);
		script = script(scriptPrefix, args);
		if (script === false || (typeof script === 'number' && script != NON_ERROR)) {
			return Promise.reject({
				message: chalk.red(`${scriptName} failed with status ${script}`)
			});
		}
		if (script === true || script === NON_ERROR || script === null || script === undefined || script === '') {
			// explicit success, or implicit success (treat null/undefined as no-op)
			return Promise.resolve(0);
		}

		// If script returns a promise, just return the promise
		if (script instanceof Promise) {
			return new Promise((resolve, reject) => {
				script.then(
					() => resolve(0),
					error => {
						reject({
							message: chalk.red(`${scriptName} failed with ${error}`),
							ref: 'function-as-script-rejection',
							error
						});
					}
				);
			});
		}
	}

	if (!isString(script)) {
		return Promise.reject({
			message: chalk.red(
				oneLine`
          Scripts must resolve to a string or a function.
          There is no script that can be resolved from "${scriptPrefix}"
        `
			),
			ref: 'missing-script'
		});
	}
	const command = [script, ...args].join(' ').trim();
	const showScript = options.scripts;
	log.info(
		oneLine`
    ${chalk.gray('nps is executing')}
     \`${chalk.bold(scriptName)}\`
     ${showScript ? `: ${chalk.green(command)}` : ''}
  `
	);
	let child;
	return new Promise((resolve, reject) => {
		child = spawn(command, { stdio: 'inherit', env: getEnv() });

		child.on('error', error => {
			reject({
				message: chalk.red(
					oneLine`
            The script called "${scriptPrefix}"
            which runs "${command}" emitted an error
          `
				),
				ref: 'emitted-an-error',
				error
			});
		});

		child.on('close', code => {
			if (code === NON_ERROR) {
				resolve(code);
			} else {
				reject({
					message: chalk.red(
						oneLine`
              The script called "${scriptPrefix}"
              which runs "${command}" failed with exit code ${code}
            `
					),
					ref: 'failed-with-exit-code',
					code
				});
			}
		});
	});
}

function getEnv() {
	const env = clone(process.env);
	const alterPath = managePath(env);
	const npmBin = findUpSync('node_modules/.bin');
	if (npmBin) {
		alterPath.unshift(npmBin);
	}
	return env;
}
