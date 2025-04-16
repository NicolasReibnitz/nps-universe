import { shell } from 'execa';

export default command => {
	const output = shell(command, { env: { FORCE_COLOR: true }, stdin: process.stdin });
	output.stdout.pipe(process.stdout);
	output.stderr.pipe(process.stderr);
};
