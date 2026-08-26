import rawCoffeeBenchV4 from '../../../../static/benchmarks/coffeebench-v0/results/1.0.0-dev.coffeebench-v0-deepseek-v4-reliable-official.preview.c9302744f0cfd061/c9302744f0cfd061975870978fe3036851c05f606800cd605ffa953e8e117ac4.json';
import {
	assertCoffeeBenchV0RouteIdentity,
	parseCoffeeBenchPublicExport
} from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV4);
assertCoffeeBenchV0RouteIdentity(coffeeBenchV0);
