import rawCoffeeBenchV2 from '../../../../static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-fixture-generation.fixture.757c6cb62911f854/757c6cb62911f85433e88a7352308355866ed848645d84b31f962a14b47df524.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV2);
assertCoffeeBenchV0RouteIdentity(coffeeBenchV0);
