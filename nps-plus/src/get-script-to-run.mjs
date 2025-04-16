import each from 'lodash/each.js';
import cloneDeep from 'lodash/cloneDeep.js';
import isPlainObject from 'lodash/isPlainObject.js';
import isUndefined from 'lodash/isUndefined.js';
import isString from 'lodash/isString.js';
import isFunction from 'lodash/isFunction.js';

import prefixMatches from 'prefix-matches';
import resolveScriptObjectToString from './resolve-script-object-to-string.mjs';
import kebabAndCamelCasify from './kebab-and-camel-casify.mjs';

export default getScriptToRun;

function getScriptToRun(config, input) {
	config = kebabAndCamelCasify(config);
	// remove the default objects/strings so we cancheck
	// if the prefix works with another script first
	const defaultlessConfig = removeDefaults(cloneDeep(config));
	const scriptToRun = getScript(defaultlessConfig, input);
	if (!isUndefined(scriptToRun) && (isString(scriptToRun.script) || isFunction(scriptToRun.script))) {
		return scriptToRun;
	} else {
		// fallback to the defaults if no other script was
		// found with the given input
		return getScript(config, input);
	}
}

function getScript(config, input) {
	const [script] = prefixMatches(input, config);
	if (script) {
		const scriptName = Object.keys(script).shift();
		let scriptToRun = script[scriptName];
		if (scriptName) {
			if (isPlainObject(scriptToRun)) {
				scriptToRun = resolveScriptObjectToString(scriptToRun);
			}
		}
		return {
			scriptName,
			script: scriptToRun
		};
	}
	return undefined;
}

function removeDefaults(object) {
	each(object, (value, key) => {
		if (key === 'default') {
			delete object[key];
		} else if (isPlainObject(value)) {
			object[key] = removeDefaults(value);
		}
	});
	return object;
}
