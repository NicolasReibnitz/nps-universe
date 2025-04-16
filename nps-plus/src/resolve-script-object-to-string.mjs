import isString from 'lodash/isString.js';
import isPlainObject from 'lodash/isPlainObject.js';
import isUndefined from 'lodash/isUndefined.js';

export { resolveScriptObjectToString as default, resolveScriptObjectToScript };

function resolveScriptObjectToString(script) {
	const scriptObj = resolveScriptObjectToScript(script);
	if (isPlainObject(scriptObj)) {
		return scriptObj.script;
	}
	return undefined;
}

function resolveScriptObjectToScript(script) {
	if (isPlainObject(script)) {
		return resolvePlainObjectToScript(script);
	} else if (isString(script)) {
		return { script };
	}
	return undefined;
}

function resolvePlainObjectToScript(script) {
	if (!isUndefined(script.script)) {
		return script;
	}
	if (!isUndefined(script.default)) {
		return resolveScriptObjectToScript(script.default);
	}
	return undefined;
}
