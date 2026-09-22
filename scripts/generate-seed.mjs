import { readFile,writeFile } from 'node:fs/promises'
const rows=JSON.parse(await readFile(new URL('../supabase/seeds/keywords.json',import.meta.url),'utf8'))
const seen=new Set()
for(const r of rows){if(seen.has(r.keyword)||!r.keyword||r.aliases.length>5)throw new Error('Invalid seed: '+r.keyword);seen.add(r.keyword)}
const data=JSON.stringify(rows)
if(data.includes('$seed$'))throw new Error('Invalid delimiter')
const sql=`-- Generated from keywords.json. Re-run npm run seed:sql after editing.\ninsert into public.trend_keywords(keyword,slug,category,aliases,shopping_category,enabled)\nselect keyword,slug,category,aliases,shopping_category,enabled from jsonb_to_recordset($seed$${data}$seed$::jsonb) as x(keyword text,slug text,category text,aliases text[],shopping_category text,enabled boolean)\non conflict(keyword) do update set aliases=excluded.aliases,category=excluded.category,shopping_category=excluded.shopping_category,updated_at=now();\n`
await writeFile(new URL('../supabase/seeds/keywords.sql',import.meta.url),sql)
console.log(`${rows.length} keywords; ${rows.filter(r=>r.shopping_category).length} shopping keywords`)
