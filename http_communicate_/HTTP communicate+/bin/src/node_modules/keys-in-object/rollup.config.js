import {uglify} from 'rollup-plugin-uglify';

export default {
	input: 'src/index.js',
	output: {
		file: 'build/keysInObject.js',
		format: 'umd',
		name: 'keysInObject',
	},	
	plugins: [
		uglify()
	],
};