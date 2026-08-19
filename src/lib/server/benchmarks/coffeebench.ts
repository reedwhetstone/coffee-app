import rawCoffeeBenchV3 from '../../../../static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-v0-deepseek-v4-initial-official.preview.fe3927ea498ccdcf/fe3927ea498ccdcf3998f08943dddf51a60ccf7e993b5744b8bf868db87565ba.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV3);
assertCoffeeBenchV0RouteIdentity(coffeeBenchV0);
