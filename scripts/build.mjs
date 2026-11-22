import {readdir,mkdir,copyFile,rm} from 'node:fs/promises';
await rm('public',{recursive:true,force:true});await mkdir('public');
for(const file of await readdir('.',{withFileTypes:true}))if(file.isFile()&&/\.(html|css|js|png|jpg|jpeg|webp|svg|webmanifest)$/.test(file.name))await copyFile(file.name,'public/'+file.name);
console.log('Copied public site assets only. Server source, credentials, tests and rule files are excluded.');
