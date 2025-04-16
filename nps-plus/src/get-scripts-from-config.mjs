// import {isPlainObject, isFunction} from 'lodash'
import isPlainObject from 'lodash/isPlainObject.js';
import isFunction from 'lodash/isFunction.js';

export default getScriptsFromConfig;

function getScriptsFromConfig(scripts, input) {
	if (isPlainObject(scripts)) {
		return scripts;
	} else if (isFunction(scripts)) {
		return scripts(input);
	}
	return {};
}
