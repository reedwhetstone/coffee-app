import rawCoffeeBenchV2 from '../../../../static/benchmarks/coffeebench-public-export-v2.json';
import { parseCoffeeBenchPublicExport } from '$lib/benchmarks/coffeebench';

// Importing the immutable artifact makes validation part of tests and every build.
// The same bytes are served from static/ for the public download.
export const coffeeBenchV0 = parseCoffeeBenchPublicExport(rawCoffeeBenchV2);
