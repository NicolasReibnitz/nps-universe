import isPlainObject from 'lodash/isPlainObject.js';
import camelCase from 'lodash/camelCase.js';
import kebabCase from 'lodash/kebabCase.js';

export default kebabAndCamelCasify;

function kebabAndCamelCasify(obj) {
	return Object.keys(obj).reduce((result, key) => {
		const camel = camelCase(key);
		const kebab = kebabCase(key);
		let val = obj[key];

		if (isPlainObject(obj[key])) {
			val = kebabAndCamelCasify(val);
		}

		setIfPossible(result, camel, val);
		setIfPossible(result, kebab, val);

		return result;
	}, obj);
}

function setIfPossible(obj, key, val) {
	if (String(key).length && !(key in obj)) {
		obj[key] = val;
	}
}
