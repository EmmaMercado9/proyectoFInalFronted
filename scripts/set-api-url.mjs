// Antes de compilar en Vercel: escribe la dirección pública del backend en environment.ts
import { writeFileSync } from 'node:fs';

const apiUrl = process.env.API_URL?.replace(/\/+$/, '');
if (!apiUrl) {
  console.error('Falta la variable API_URL');
  process.exit(1);
}

writeFileSync(
  'src/environments/environment.ts',
  `export const environment = {\n  production: true,\n  apiUrl: ${JSON.stringify(apiUrl)},\n};\n`
);
