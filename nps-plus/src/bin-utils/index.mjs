import { resolve } from 'path';
import { readFileSync } from 'fs';
// import { includes, isPlainObject, isUndefined, isEmpty, isFunction, isNull } from 'lodash';
import includes from 'lodash/includes.js';
import isPlainObject from 'lodash/isPlainObject.js';
import isEmpty from 'lodash/isEmpty.js';
import isUndefined from 'lodash/isUndefined.js';
import isFunction from 'lodash/isFunction.js';
import isNull from 'lodash/isNull.js';
import typeOf from 'type-detect';
import chalk from 'chalk';
// import { safeLoad } from 'js-yaml';
import { oneLine } from 'common-tags';
import getLogger from '../get-logger.mjs';
import { resolveScriptObjectToScript } from '../resolve-script-object-to-string.mjs';
import getScriptByPrefix from './get-script-by-prefix.mjs';
import initialize from './initialize/index.mjs';
import pkg from 'js-yaml';
const { safeLoad } = pkg;
const log = getLogger();

/**
 * Attempts to load the given module. This is used for the
 * --require functionality of the CLI
 * @param  {String} moduleName The module to attempt to require
 * @return {*} The required module
 */
const preloadModule = getAttemptModuleRequireFn((moduleName, requirePath) => {
	log.warn({
		message: chalk.yellow(
			oneLine`
        Unable to preload "${moduleName}".
        Attempted to require as "${requirePath}"
      `
		),
		ref: 'unable-to-preload-module'
	});
	return undefined;
});

const loadJSConfig = getAttemptModuleRequireFn(function onFail(configPath, requirePath, err) {
	if (err) {
		throw err;
	}
	log.error({
		message: chalk.red(
			oneLine`
        Unable to find JS config at "${configPath}".
      `
		),
		ref: 'unable-to-find-config'
	});
	return undefined;
});

/**
 * Attempts to load the config and logs an error if there's a problem
 * @param {String} configPath The path to attempt to require the config from
 * @param {*} input the input to pass to the config if it's a function
 * @return {Object} The config
 */

async function loadConfig(configPath, input) {
	let config;
	if (configPath.endsWith('.yml') || configPath.endsWith('.yaml')) {
		config = loadYAMLConfig(configPath);
	} else {
		config = await loadJSConfig(configPath);
	}

	if (isUndefined(config)) {
		// let the caller deal with this
		return config;
	}
	let typeMessage = `Your config data type was`;
	if (isFunction(config)) {
		config = config(input);
		typeMessage = `${typeMessage} a function which returned`;
	}
	const emptyConfig = isEmpty(config);
	const plainObjectConfig = isPlainObject(config);
	if (plainObjectConfig && emptyConfig) {
		typeMessage = `${typeMessage} an object, but it was empty`;
	} else {
		typeMessage = `${typeMessage} a data type of "${typeOf(config)}"`;
	}
	if (!plainObjectConfig || emptyConfig) {
		log.error({
			message: chalk.red(
				oneLine`
          The package-scripts configuration
          ("${configPath.replace(/\\/g, '/')}") must be a non-empty object
          or a function that returns a non-empty object.
        `
			),
			ref: 'config-must-be-an-object'
		});
		throw new Error(typeMessage);
	}

	const defaultConfig = {
		options: {
			'help-style': 'all'
		}
	};

	return { ...defaultConfig, ...config };
}

export { initialize, help, getModuleRequirePath, preloadModule, loadConfig, specificHelpScript };

/****** implementations ******/

function loadYAMLConfig(configPath) {
	try {
		return safeLoad(readFileSync(configPath, 'utf8'));
	} catch (e) {
		if (e.constructor.name === 'YAMLException') {
			throw e;
		}
		log.error({
			message: chalk.red(`Unable to find YML config at "${configPath}".`),
			ref: 'unable-to-find-config'
		});
		return undefined;
	}
}

/**
 * Determines the proper require path for a module.
 * If the path starts with `.` then it is resolved with process.cwd()
 * @param  {String} moduleName The module path
 * @return {String} the module path to require
 */
// function getModuleRequirePath(moduleName) {
// 	const result = moduleName[0] === '.' ? require.resolve(resolve(process.cwd(), moduleName)) : moduleName;

// 	return result;
// }

async function getModuleRequirePath(moduleName) {
	if (moduleName[0] === '.') {
		const modulePath = resolve(process.cwd(), moduleName);
		return import(modulePath);
	} else {
		return import(moduleName);
	}
}

function getAttemptModuleRequireFn(onFail) {
	return async function attemptModuleRequire(moduleName) {
		try {
			const module = await getModuleRequirePath(moduleName);
			return module.default || module;
		} catch (error) {
			console.error(`Unable to load module: ${moduleName}`, error);
			return onFail(moduleName, module, error);
		}
		// let requirePath;
		// try {
		// 	requirePath = getModuleRequirePath(moduleName);
		// } catch (_e) {
		// 	return onFail(moduleName);
		// }
		// try {
		// 	return requireDefaultFromModule(requirePath);
		// } catch (e) {
		// 	return onFail(moduleName, requirePath, e);
		// }
	};
}

/**
 * Requires the given module and returns the `default` if it's an `__esModule`
 * @param  {String} modulePath The module to require
 * @return {*} The required module (or it's `default` if it's an `__esModule`)
 */
function requireDefaultFromModule(modulePath) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
	const mod = require(modulePath);
	if (mod.__esModule) {
		return mod.default;
	} else {
		return mod;
	}
}

function scriptObjectToChalk(options, { name, description, script }) {
	const coloredName = chalk.green(name);
	const coloredScript = chalk.gray(script);
	const line = [coloredName];
	let showScript = true;
	if (typeof options !== 'undefined' && options['help-style'] === 'basic') {
		showScript = false;
	}
	if (description) {
		line.push(chalk.white(description));
	}
	if (showScript) {
		line.push(coloredScript);
	}
	return line.join(' - ').trim();
}

function help({ scripts, options }) {
	const availableScripts = getAvailableScripts(scripts);
	const filteredScripts = availableScripts.filter(script => !script.hiddenFromHelp);
	if (filteredScripts.length > 0) {
		const scriptLines = filteredScripts.map(scriptObjectToChalk.bind(null, options || { 'help-style': 'all' }));
		const topMessage = 'Available scripts (camel or kebab case accepted)';
		const message = `${topMessage}\n\n${scriptLines.join('\n')}`;
		return message;
	} else {
		return chalk.yellow('There are no scripts available');
	}
}

function specificHelpScript(config, scriptName) {
	const script = getScriptByPrefix(config, scriptName);
	if (isNull(script)) {
		return chalk.yellow(`Script matching name ${scriptName} was not found.`);
	} else {
		return scriptObjectToChalk({ 'help-style': 'all' }, script);
	}
}

function getAvailableScripts(config, prefix = [], rootLevel = true) {
	const excluded = ['description', 'script'];
	if (!rootLevel) {
		excluded.push('default');
	}
	return Object.keys(config).reduce((scripts, key) => {
		const val = config[key];
		if (includes(excluded, key)) {
			return scripts;
		}
		const scriptObj = resolveScriptObjectToScript(val);
		const prefixed = [...prefix, key];
		if (scriptObj) {
			const { description, script, hiddenFromHelp = false } = scriptObj;
			scripts = [...scripts, { name: prefixed.join('.'), description, script, hiddenFromHelp }];
		}
		if (isPlainObject(val)) {
			return [...scripts, ...getAvailableScripts(val, prefixed, false)];
		}
		return scripts;
	}, []);
}
