export const time = seconds => { const n=Math.max(0,Math.floor(seconds||0)); return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`; };
export function mergeRanges(ranges) {
 const sorted=ranges.filter(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[1]>r[0]&&r[0]>=0).sort((a,b)=>a[0]-b[0]);
 const result=[];for(const [start,end] of sorted){const last=result.at(-1);if(last&&start<=last[1]+.2)last[1]=Math.max(end,last[1]);else result.push([start,end]);}return result;
}
export const listened = ranges => mergeRanges(ranges||[]).reduce((s,[a,b])=>s+b-a,0);
export function combine(a={},b={}) {
 const fresh=(a.updatedAt||0)>(b.updatedAt||0)?a:b;
 return {...a,...b,...fresh,ranges:mergeRanges([...(a.ranges||[]),...(b.ranges||[])]),completed:!!(a.completed||b.completed),playCount:Math.max(a.playCount||0,b.playCount||0)};
}
export const localDay=()=>new Date().toLocaleDateString('sv-SE');
