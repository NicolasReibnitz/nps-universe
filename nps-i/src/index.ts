#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import fuzzyPkg from 'fuzzy';
import inquirer from 'inquirer';
import autocomplete from 'inquirer-autocomplete-prompt';
import pad from 'right-pad';

import exec from './exec.mjs';

const { filter } = fuzzyPkg;

const DEFAULT_CONFIG_PATH = './package-scripts.js';

async function getConfigPath() {
	let configPath = DEFAULT_CONFIG_PATH;
	try {
		if (existsSync(join(process.cwd(), './.npsrc'))) {
			configPath = JSON.parse(readFileSync(join(process.cwd(), './.npsrc'))).config;
		} else if (existsSync(join(process.cwd(), './.npsrc.json'))) {
			configPath = JSON.parse(readFileSync(join(process.cwd(), './.npsrc.json'))).config;
		} else if (existsSync(join(process.cwd(), './package-scripts.cjs'))) {
			configPath = './package-scripts.cjs';
		} else if (existsSync(join(process.cwd(), './package-scripts.mjs'))) {
			configPath = './package-scripts.mjs';
		}
	} catch (_e) {
		configPath = DEFAULT_CONFIG_PATH;
	}
	return configPath;
}

// Main program wrapped in async IIFE
(async () => {
	const configPath = await getConfigPath();
	const config = await import(join(process.cwd(), configPath));
	const packageScripts = config.default?.scripts || config.scripts;

	let flatScripts = [];

	const flattenScripts = (scripts, prefix) => {
		const keys = Object.keys(scripts);
		keys.forEach(key => {
			// format = name: command
			let script;
			let description;
			let name;

			if (prefix) name = prefix + '.' + key;
			else name = key;

			if (typeof scripts[key] === 'string') {
				script = scripts[key];
				description = '';
			}

			if (typeof scripts[key] === 'object') {
				const shape = scripts[key];

				if (shape.hiddenFromInteractive) {
					return;
				}

				// format = name: { default: command }
				if (typeof shape.default === 'string') {
					flatScripts.push({ name: 'Separator', script: '', description: '' });
					flatScripts.push({ name, script: shape.default, description: shape.description || '' });
					delete shape.default;
					delete shape.description;
				}

				// format = name: { script: command }
				if (typeof shape.script === 'string') {
					script = shape.script;
					description = shape.description || '';

					delete shape.script;
					delete shape.description;
				}

				// recursively call for other shapes inside this object
				// format = parent: { child: { script: command } }
				flattenScripts(shape, name);
			}

			if (script) {
				flatScripts.push({ name, script, description });
			} else {
				flatScripts.push({ name: 'Separator', script: '', description: '' });
			}
		});
	};

	/* Flatten scripts */
	flattenScripts(packageScripts);

	/* Find longest key */
	let longestKey = '';
	flatScripts.forEach(element => {
		if (element.name.length > longestKey.length) longestKey = element.name;
	});

	/* Width of key column */
	const width = longestKey.length + 5;

	/* Add pretty string to each element */
	flatScripts = flatScripts.map(element => {
		element.prettyString = `${pad(element.name, width)} ${element.description}`;
		return element;
	});

	const fuzzyOptions = {
		extract: element => element.prettyString
	};

	const filterScripts = (_, input) => {
		input = input || '';

		return new Promise(resolve => {
			let lastTypeWasSeparator = false;
			const results = filter(input, flatScripts, fuzzyOptions);
			const prettyResults = results.map(result => {
				if (result.original.name === 'Separator') {
					if (lastTypeWasSeparator) {
						return false;
					}
					lastTypeWasSeparator = true;
					return new inquirer.Separator();
				}
				lastTypeWasSeparator = false;
				return result.original.prettyString;
			});
			const filteredResults = prettyResults.filter(result => result);

			if (filteredResults[filteredResults.length - 1] instanceof inquirer.Separator) {
				filteredResults.pop();
			}

			if (filteredResults[0] instanceof inquirer.Separator) {
				filteredResults.shift();
			}

			resolve(filteredResults);
		});
	};

	const autocompleteOptions = {
		type: 'autocomplete',
		name: 'string',
		message: config.message || 'Which script would you like to run?\n\n',
		pageSize: config.pageSize || 15,
		source: filterScripts
	};

	inquirer.registerPrompt('autocomplete', autocomplete);
	inquirer.prompt(autocompleteOptions).then(result => {
		const element = flatScripts.find(element => element.prettyString === result.string);
		exec(`nps -c ${configPath} ${element.name}`);
	});
})();
