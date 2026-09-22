import type { Comparison } from '@shared/types'
import { BRAND,PERIOD_LABELS } from '@shared/config'
export async function shareCard(data:Comparison,mock=false):Promise<Blob>{
 await document.fonts.ready
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=630
 const c=canvas.getContext('2d');if(!c)throw new Error('이미지를 생성할 수 없습니다.')
 c.fillStyle='#102a2b';c.fillRect(0,0,1200,630)
 c.fillStyle='#a9e4ca';c.font='bold 30px system-ui';c.fillText(BRAND.name,64,70)
 c.fillStyle='#fff';c.font='bold 42px system-ui';c.textAlign='center'
 const fit=(text:string,x:number)=>{let size=42;while(size>18&&c.measureText(text).width>470){size-=2;c.font=`bold ${size}px system-ui`}c.fillText(text,x,210,470);c.font='bold 42px system-ui'}
 fit(data.a,300);fit(data.b,900)
 c.font='bold 90px system-ui';c.fillStyle='#a9e4ca';c.fillText(String(data.shareA??'—'),300,340);c.fillStyle='#ffb993';c.fillText(String(data.shareB??'—'),900,340)
 c.fillStyle='#fff';c.font='30px system-ui';c.fillText('VS',600,280)
 c.fillText(`${PERIOD_LABELS[data.period]} · 비교 관심도`,600,425)
 c.fillStyle='#b0c6c1';c.font='22px system-ui';c.fillText(`${data.trend.endDate} 기준 · 두 대상 간 상대 지수 비율`,600,510)
 c.fillText(mock?'체험용 가상 데이터 · 실제 통계가 아닙니다.':'실제 검색량·시장점유율이 아닙니다.',600,550)
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('이미지 생성 실패')),'image/png'))
}
export async function saveCard(data:Comparison,mock=false){const blob=await shareCard(data,mock),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='comparison.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
