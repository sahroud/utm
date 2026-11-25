(function(root){
'use strict';
const VERSION='1.1.1';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function normalizeFix(input,options){
 const p=input||{},o=options||{},lat=Number(p.lat),lon=Number(p.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return null;
 const accuracy=finite(p.accuracy)&&p.accuracy>=0?p.accuracy:null;
 if(accuracy!==null&&accuracy>(finite(o.maxAccuracy)?o.maxAccuracy:200))return null;
 return {lat,lon,alt:finite(p.alt)?p.alt:null,accuracy,speed:finite(p.speed)?p.speed:null,heading:finite(p.heading)?((p.heading%360)+360)%360:null,time:finite(p.time)?p.time:Date.now(),source:String(p.source||'GNSS').slice(0,80),fix:String(p.fix||'').toUpperCase(),sats:finite(p.sats)?p.sats:null,hdop:finite(p.hdop)?p.hdop:null,diffAge:finite(p.diffAge)?p.diffAge:null};
}
function checksumOK(line){
 if(typeof line!=='string'||line.charCodeAt(0)!==36)return false;
 const star=line.indexOf('*');if(star<0)return false;
 let sum=0;for(let i=1;i<star;i++)sum^=line.charCodeAt(i);
 const expected=parseInt(line.slice(star+1,star+3),16);
 return Number.isFinite(expected)&&sum===expected;
}
function nmeaCoord(raw,hem){
 if(!raw||!hem)return NaN;const v=Number(raw);if(!Number.isFinite(v))return NaN;
 const deg=Math.floor(v/100),min=v-deg*100;if(min<0||min>=60)return NaN;
 let out=deg+min/60;if(hem==='S'||hem==='W')out=-out;else if(hem!=='N'&&hem!=='E')return NaN;
 return out;
}
function parseNmea(line){
 if(!checksumOK(line))return null;
 const star=line.indexOf('*'),f=line.slice(1,star).split(','),type=(f[0]||'').slice(-3);
 const val=v=>v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
 if(type==='GST'){
  const lat=val(f[6]),lon=val(f[7]),rms=val(f[2]);
  return {type,accuracy:lat!==null&&lon!==null?Math.hypot(lat,lon):null,rms};
 }
 if(type!=='GGA'||f.length<12)return null;
 const lat=nmeaCoord(f[2],f[3]),lon=nmeaCoord(f[4],f[5]),q=val(f[6]);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||q===null||q===0)return null;
 const msl=val(f[9]),geoid=val(f[11]);
 return {type,lat,lon,quality:q,sats:val(f[7]),hdop:val(f[8]),msl,geoid,ellipsoid:msl!==null&&geoid!==null?msl+geoid:msl,diffAge:val(f[13]),station:(f[14]||'').trim()};
}
function quality(f){
 if(!f)return {level:'invalid',label:'نامعتبر',usable:false};
 const t=String(f.fix||'').toUpperCase();
 if(t==='FIX'||t==='RTK FIX')return {level:'rtk-fixed',label:'RTK FIX',usable:true};
 if(t==='FLOAT'||t==='RTK FLOAT')return {level:'rtk-float',label:'RTK FLOAT',usable:true};
 if(t==='DGPS')return {level:'dgps',label:'DGPS',usable:true};
 if(f.accuracy===null)return {level:'unknown',label:'دقت نامشخص',usable:true};
 if(f.accuracy<=0.05)return {level:'survey',label:'دقت اعلامی بسیار بالا؛ نیازمند راستی‌آزمایی',usable:true};
 if(f.accuracy<=1)return {level:'high',label:'دقت اعلامی بالا',usable:true};
 if(f.accuracy<=5)return {level:'medium',label:'دقت اعلامی متوسط',usable:true};
 return {level:'low',label:'دقت اعلامی پایین',usable:true};
}
function utmZone(lon){if(!finite(lon)||lon < -180||lon > 180)return null;return Math.min(60,Math.max(1,Math.floor((lon+180)/6)+1));}
function meanFixes(items){
 const a=(Array.isArray(items)?items:[]).map(x=>normalizeFix(x)).filter(Boolean);if(!a.length)return null;
 const w=a.map(x=>x.accuracy&&x.accuracy>0?1/(x.accuracy*x.accuracy):1),sum=w.reduce((x,y)=>x+y,0);
 const avg=k=>a.reduce((s,x,i)=>s+x[k]*w[i],0)/sum,alts=a.filter(x=>finite(x.alt));
 return {lat:avg('lat'),lon:avg('lon'),alt:alts.length?alts.reduce((s,x)=>s+x.alt,0)/alts.length:null,count:a.length,time:Math.max(...a.map(x=>x.time)),source:'SAHROUD weighted mean',accuracy:a.every(x=>x.accuracy!==null)?Math.sqrt(1/sum):null,note:'میانگین‌گیری دقت ذاتی گیرنده را تضمین یا بهبود قطعی نمی‌دهد.'};
}
root.SAHROUD_GNSS=Object.freeze({version:VERSION,normalizeFix,quality,utmZone,meanFixes,checksumOK,parseNmea});
})(typeof window!=='undefined'?window:this);