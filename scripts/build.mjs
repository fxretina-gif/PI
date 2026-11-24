import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
await mkdir(resolve(root,'public'),{recursive:true});
for(const name of await readdir(resolve(root,'web'))) {
  if(name==='signin.html')continue;
  await copyFile(resolve(root,'web',name),resolve(root,'public',name));
}
const wedding=JSON.parse(await readFile(resolve(root,'wedding.json'),'utf8'));
await writeFile(resolve(root,'public/config.js'),'window.WEDDING='+JSON.stringify(wedding).replace(/</g,'\\u003c')+';\n');
await copyFile(resolve(root,'server/api.php'),resolve(root,'public/api.php'));
console.log('Built Hostinger site in public/. No dependencies required.');
