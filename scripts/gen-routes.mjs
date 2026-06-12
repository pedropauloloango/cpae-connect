import { generator } from '@tanstack/router-generator';
import { getConfig } from '@tanstack/router-plugin/dist/esm/core/config.js';
const config = getConfig({}, process.cwd());
console.log('routesDir:', config.routesDirectory, 'gen:', config.generatedRouteTree);
await generator(config, process.cwd());
console.log('Generated.');
