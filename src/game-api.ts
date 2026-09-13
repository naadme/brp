/** Lightweight browser store for the no-account version of Bro, Don't. */
export type Advice = { id:string; text:string; author:string; votes:number; mine?:boolean; reported?:boolean };
export type Situation = { id:string; title:string; context:string; tag:string; author:string; time:string; advice:Advice[]; hot:number };
export type Profile = { name:string; handle:string; points:number; avatar:string; joined:string; email?:string };
export type GameData = { situations: Situation[]; profile: Profile };
const STORE = 'bro-dont-v1';
export const gameApi = {
 read(): GameData | null { try{const data=JSON.parse(localStorage.getItem(STORE)||'null') as GameData|null;if(data) data.situations=data.situations.filter(s=>!['s1','s2','s3'].includes(s.id));return data}catch{return null} },
 write(data:GameData){localStorage.setItem(STORE,JSON.stringify(data))},
 canPost(kind:'situation'|'advice'){const last=Number(localStorage.getItem(`bro-dont-last-${kind}`)||0);return Date.now()-last>15_000},
 markPost(kind:'situation'|'advice'){localStorage.setItem(`bro-dont-last-${kind}`,String(Date.now()))}
};
