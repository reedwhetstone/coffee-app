import rawCoffeeBenchV5 from '../../../../static/benchmarks/coffeebench-v1/results/1.0.0.coffeebench-v0-deepseek-v4-reliable-official.published.50ca8fbd22a8523e/50ca8fbd22a8523eacb13bc21c5eb890a2fd60f3e55db8a386a00bc8b94bb087.json';
import {
	assertCoffeeBenchV1RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV1 = parseCoffeeBenchPublicExport(rawCoffeeBenchV5);
assertCoffeeBenchV1RouteIdentity(coffeeBenchV1);
