import rawCoffeeBenchV2 from '../../../../static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-fixture-generation.fixture.1071e9c16437645f/1071e9c16437645fcf844abfa95936e4a983f9d10b85663451ea6bed2ee37e9e.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV2);
assertCoffeeBenchV0RouteIdentity(coffeeBenchV0);
