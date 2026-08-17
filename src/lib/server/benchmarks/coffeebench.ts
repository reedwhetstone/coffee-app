import rawCoffeeBenchV2 from '../../../../static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-fixture-generation.fixture.a8bc2608867ba777/a8bc2608867ba7773c7262eef50049a38819c964c4ade6ce661c2616000bfd23.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV2);
assertCoffeeBenchV0RouteIdentity(coffeeBenchV0);
