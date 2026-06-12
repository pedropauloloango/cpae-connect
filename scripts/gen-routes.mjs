import { generator, getConfig } from '@tanstack/router-generator';
const config = getConfig({ routesDirectory: './src/routes', generatedRouteTree: './src/routeTree.gen.ts' }, process.cwd());
await generator(config, process.cwd());
console.log('Generated:', config.generatedRouteTree);
