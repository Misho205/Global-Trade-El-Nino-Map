import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyStripeSignature(body:string,header:string,secret:string,now=Date.now()) {
 if(!secret||body.length>1_000_000||header.length>2000)return false;
 const parts=header.split(','),time=parts.find(p=>p.startsWith('t='))?.slice(2);
 if(!time||!/^\d+$/.test(time)||Math.abs(now/1000-Number(time))>300)return false;
 const expected=createHmac('sha256',secret).update(time+'.'+body).digest();
 return parts.filter(p=>p.startsWith('v1=')).some(p=>{const value=p.slice(3);return /^[a-f0-9]{64}$/i.test(value)&&timingSafeEqual(expected,Buffer.from(value,'hex'));});
}
