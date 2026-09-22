import { build } from 'esbuild'
import { mkdtemp,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const temp=await mkdtemp(join(tmpdir(),'trendpick-tests-'))
try{const outfile=join(temp,'core.mjs');await build({entryPoints:['tests/core.ts'],outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});await import(pathToFileURL(outfile).href);await import('./database.mjs');await import('./collector.mjs');const apiFile=join(temp,'api.mjs');await build({entryPoints:['tests/api.ts'],outfile:apiFile,bundle:true,platform:'node',format:'esm',logLevel:'silent'});await import(pathToFileURL(apiFile).href)}finally{await rm(temp,{recursive:true,force:true})}
