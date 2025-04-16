/* eslint-disable no-unused-vars */
import npsUtils from 'nps-utils';

const {
	series: { nps: series },
	concurrent: { nps: parallel }
} = npsUtils;

export const scripts = {
	default: 'echo default',
	object: {
		script: 'echo object',
		description: 'This one is an object'
	},
	nested: {
		dev: {
			script: 'echo nested dev',
			description: 'nested dev'
		},
		prod: {
			script: 'echo nested prod',
			description: 'nested prod'
		}
	}
};
