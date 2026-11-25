(function(root){
'use strict';
const VERSION='1.3.0';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function normalizeHeight(input){
 const p=input||{},value=Number(p.value),type=String(p.type||'unknown').toLowerCase();
 const N=finite(p.geoidSeparation)?p.geoidSeparation:null;
 if(!Number.isFinite(value)||!['ellipsoid','msl','orthometric'].includes(type))return {value:null,type:'unknown',ellipsoid:null,msl:null,geoidSeparation:N,converted:false,warning:'نوع یا مقدار ارتفاع مشخص نیست.'};
 if(type==='ellipsoid')return {value,type,ellipsoid:value,msl:N!==null?value-N:null,geoidSeparation:N,converted:N!==null,warning:N===null?'برای تبدیل به MSL، جدایی ژئوئید معتبر لازم است.':null};
 return {value,type,ellipsoid:N!==null?value+N:null,msl:value,geoidSeparation:N,converted:N!==null,warning:N===null?'ارتفاع MSL ثبت شد؛ برای تبدیل به بیضوی، جدایی ژئوئید معتبر لازم است.':null};
}
function normalizeFix(input,options){
 const p=input||{},o=options||{},lat=Number(p.lat),lon=Number(p.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)return null;
 const accuracy=finite(p.accuracy)&&p.accuracy>=0?p.accuracy:null;
 if(accuracy!==null&&accuracy>(finite(o.maxAccuracy)?o.maxAccuracy:200))return null;
 const height=normalizeHeight({value:p.alt,type:p.altitudeType||'unknown',geoidSeparation:p.geoidSeparation});
 return {lat,lon,alt:finite(p.alt)?p.alt:null,height,accuracy,speed:finite(p.speed)?p.speed:null,heading:finite(p.heading)?((p.heading%360)+360)%360:null,time:finite(p.time)?p.time:Date.now(),source:String(p.source||'GNSS').slice(0,80),fix:String(p.fix||'').toUpperCase(),sats:finite(p.sats)?p.sats:null,hdop:finite(p.hdop)?p.hdop:null,diffAge:finite(p.diffAge)?p.diffAge:null};
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
 return {type,lat,lon,quality:q,sats:val(f[7]),hdop:val(f[8]),msl,geoid,height:normalizeHeight({value:msl,type:'msl',geoidSeparation:geoid}),diffAge:val(f[13]),station:(f[14]||'').trim()};
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
function normalizeCRS(input){
 const p=input||{},type=String(p.type||'WGS84').toUpperCase(),datum=String(p.datum||'WGS84').toUpperCase();
 if(type==='WGS84'||type==='GEOGRAPHIC'){
  if(datum!=='WGS84')return {valid:false,type:'WGS84',datum,epsg:null,warning:'این نسخه فقط Datum جغرافیایی WGS84 را تأیید می‌کند.'};
  return {valid:true,type:'WGS84',datum:'WGS84',epsg:4326,zone:null,hemisphere:null,units:'degree'};
 }
 if(type==='UTM'){
  const zone=Number(p.zone),hemisphere=String(p.hemisphere||'N').toUpperCase();
  if(datum!=='WGS84'||!Number.isInteger(zone)||zone<1||zone>60||!['N','S'].includes(hemisphere))return {valid:false,type:'UTM',datum,epsg:null,zone:Number.isInteger(zone)?zone:null,hemisphere,warning:'UTM نیازمند Datum WGS84، زون صحیح ۱ تا ۶۰ و نیم‌کره N یا S است.'};
  return {valid:true,type:'UTM',datum:'WGS84',epsg:(hemisphere==='N'?32600:32700)+zone,zone,hemisphere,units:'metre'};
 }
 return {valid:false,type,datum,epsg:null,warning:'سیستم مختصات پشتیبانی یا شناسایی نشد؛ تبدیل خودکار انجام نشد.'};
}
function validateCoordinate(point,crs){
 const p=point||{},c=normalizeCRS(crs);
 if(!c.valid)return {valid:false,crs:c,warning:c.warning};
 const x=Number(p.x),y=Number(p.y);
 if(!Number.isFinite(x)||!Number.isFinite(y))return {valid:false,crs:c,warning:'مختصات باید عددی باشند.'};
 if(c.type==='WGS84'&&(x < -180||x > 180||y < -90||y > 90))return {valid:false,crs:c,warning:'طول یا عرض جغرافیایی خارج از محدوده WGS84 است.'};
 if(c.type==='UTM'&&(x<100000||x>900000||y<0||y>10000000))return {valid:false,crs:c,warning:'Easting یا Northing خارج از محدوده متعارف UTM است.'};
 return {valid:true,crs:c,x,y,warning:null};
}
function sameCRS(a,b){
 const x=normalizeCRS(a),y=normalizeCRS(b);
 return x.valid&&y.valid&&x.epsg===y.epsg;
}
function utmZone(lon){if(!finite(lon)||lon < -180||lon > 180)return null;return Math.min(60,Math.max(1,Math.floor((lon+180)/6)+1));}
function meanFixes(items){
 const a=(Array.isArray(items)?items:[]).map(x=>normalizeFix(x)).filter(Boolean);if(!a.length)return null;
 const w=a.map(x=>x.accuracy&&x.accuracy>0?1/(x.accuracy*x.accuracy):1),sum=w.reduce((x,y)=>x+y,0);
 const avg=k=>a.reduce((s,x,i)=>s+x[k]*w[i],0)/sum,alts=a.filter(x=>finite(x.alt));
 return {lat:avg('lat'),lon:avg('lon'),alt:alts.length?alts.reduce((s,x)=>s+x.alt,0)/alts.length:null,count:a.length,time:Math.max(...a.map(x=>x.time)),source:'SAHROUD weighted mean',accuracy:a.every(x=>x.accuracy!==null)?Math.sqrt(1/sum):null,note:'میانگین‌گیری دقت ذاتی گیرنده را تضمین یا بهبود قطعی نمی‌دهد.'};
}
root.SAHROUD_GNSS=Object.freeze({version:VERSION,normalizeFix,quality,utmZone,meanFixes,normalizeHeight,normalizeCRS,validateCoordinate,sameCRS,checksumOK,parseNmea});
})(typeof window!=='undefined'?window:this);