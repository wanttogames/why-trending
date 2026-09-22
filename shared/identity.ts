import { InputError } from './errors'
export function normalize(value:string):string {
 const q=value.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/\s+/g,' ').trim().toLowerCase()
 if(!q||q.length>60||/[<>\x00-\x1f/\\]/.test(q)) throw new InputError('검색어는 1~60자로 입력해 주세요.')
 return q
}
// Reversible UTF-8 hex avoids ambiguous Korean stripping and hash collisions.
export const token=(value:string)=>'k-'+[...new TextEncoder().encode(normalize(value))].map(b=>b.toString(16).padStart(2,'0')).join('')
export function untoken(value:string):string {
 if(!/^k-(?:[0-9a-f]{2}){1,240}$/.test(value)) return normalize(value)
 const bytes=Uint8Array.from(value.slice(2).match(/../g)!,s=>parseInt(s,16))
 return normalize(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
export const canonicalPair=(a:string,b:string)=>{
 const pair=[normalize(a),normalize(b)].sort()
 if(pair[0]===pair[1])throw new InputError('서로 다른 두 검색어를 입력해 주세요.')
 return pair as [string,string]
}
export const vsPath=(a:string,b:string)=>{const p=canonicalPair(a,b);return `/vs/${token(p[0])}/${token(p[1])}`}
