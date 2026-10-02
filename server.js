import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webpush from "web-push";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app=express(), PORT=Number(process.env.PORT||3000);
const REFRESH=Number(process.env.REFRESH_SECONDS||20);
const MIN_SCORE=Number(process.env.MIN_SIGNAL_SCORE||50);
const __filename=fileURLToPath(import.meta.url), __dirname=path.dirname(__filename);
app.use(cors()); app.use(express.json({limit:"256kb"})); app.use(express.static(path.join(__dirname,"public")));

const cache=new Map(), subscriptions=new Map();
const ai = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("PASTE_")
  ? new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY}) : null;

if(process.env.VAPID_PUBLIC_KEY && !process.env.VAPID_PUBLIC_KEY.includes("PASTE_")){
  webpush.setVapidDetails(process.env.VAPID_SUBJECT||"mailto:admin@example.com",process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
}
const n=v=>Number.isFinite(Number(v))?Number(v):null;
function normalize(values=[]){return values.map(x=>({datetime:x.datetime,open:n(x.open),high:n(x.high),low:n(x.low),close:n(x.close),volume:n(x.volume)||0})).filter(x=>[x.open,x.high,x.low,x.close].every(v=>v!==null)).sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));}

async function td(symbol,interval="1min",size=240){
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key||key.includes("PASTE_")) throw Error("TWELVE_DATA_API_KEY belum diisi.");
  const u=new URL("https://api.twelvedata.com/time_series");
  u.searchParams.set("symbol",symbol);u.searchParams.set("interval",interval);u.searchParams.set("outputsize",size);u.searchParams.set("timezone","UTC");u.searchParams.set("apikey",key);
  const r=await fetch(u);const d=await r.json();if(!r.ok||d.status==="error")throw Error(d.message||"Twelve Data error");
  return normalize(d.values);
}
function piv(b,s=3){let H=[],L=[];for(let i=s;i<b.length-s;i++){let h=true,l=true;for(let j=1;j<=s;j++){h&&=b[i].high>b[i-j].high&&b[i].high>=b[i+j].high;l&&=b[i].low<b[i-j].low&&b[i].low<=b[i+j].low}if(h)H.push(b[i].high);if(l)L.push(b[i].low)}return{H,L}}
function cluster(a,t){let out=[];for(const p of a){let z=out.find(x=>Math.abs(x.price-p)<=t);if(z){z.price=(z.price*z.touches+p)/(++z.touches)}else out.push({price:p,touches:1})}return out.sort((a,b)=>b.touches-a.touches)}
function technical(b){
  const last=b.at(-1), prev=b.at(-2), recent=b.slice(-80), avg=recent.reduce((s,x)=>s+x.high-x.low,0)/recent.length;
  const tol=Math.max(avg*.35,last.close*.0004), p=piv(b), S=cluster(p.L.slice(-40),tol).slice(0,6), R=cluster(p.H.slice(-40),tol).slice(0,6);
  const rh=Math.max(...b.slice(-20).map(x=>x.high)), rl=Math.min(...b.slice(-20).map(x=>x.low));
  const bull=last.close>last.open,bear=last.close<last.open,bosB=last.close>rh&&prev.close<=rh,bosS=last.close<rl&&prev.close>=rl;
  const nearS=S.find(x=>Math.abs(last.close-x.price)<=tol*1.5), nearR=R.find(x=>Math.abs(last.close-x.price)<=tol*1.5);
  let buy=0,sell=0,why=[];
  if(bull){buy+=12;why.push("bullish candle")} if(bear){sell+=12;why.push("bearish candle")}
  if(bosB){buy+=30;why.push("BOS bullish")} if(bosS){sell+=30;why.push("BOS bearish")}
  if(nearS){buy+=25;why.push("near support/demand")} if(nearR){sell+=25;why.push("near resistance/supply")}
  const body=Math.abs(last.close-last.open);
  if(body>avg*.65){bull?buy+=15:sell+=15;why.push("displacement")}
  // liquidity sweep proxy
  const sweepLow=last.low<Math.min(...b.slice(-10,-1).map(x=>x.low))&&last.close>last.open;
  const sweepHigh=last.high>Math.max(...b.slice(-10,-1).map(x=>x.high))&&last.close<last.open;
  if(sweepLow){buy+=18;why.push("liquidity sweep low")} if(sweepHigh){sell+=18;why.push("liquidity sweep high")}
  const total=Math.max(buy,sell), signal=buy>=sell?"BUY":"SELL";
  const confidence=Math.min(99,Math.round(total));
  const entry=last.close;
  const sl=signal==="BUY"?Math.min(...b.slice(-12).map(x=>x.low))-avg*.15:Math.max(...b.slice(-12).map(x=>x.high))+avg*.15;
  const risk=Math.abs(entry-sl),tp=signal==="BUY"?entry+risk*2:entry-risk*2;
  return {signal,confidence,eligible:confidence>=MIN_SCORE,entry,sl,tp,timestamp:last.datetime,support:S,resistance:R,bosBull:bosB,bosBear:bosS,sweepLow,sweepHigh,reasons:[...new Set(why)].slice(0,8),noRSI:true};
}
async function geminiAnalysis(symbol,technicalData,bars){
  if(!ai)return {enabled:false,text:"Gemini belum dikonfigurasi."};
  const compact=bars.slice(-35).map(x=>({t:x.datetime,o:x.open,h:x.high,l:x.low,c:x.close}));
  const prompt=`Analisis pasar ${symbol} secara netral. Data OHLC berikut dan hasil aturan teknikal diberikan. Fokus SNR, SND, SMC, BOS/CHOCH, liquidity sweep, order block dan price action. Jangan gunakan RSI. Jangan menjanjikan profit. Jika confidence teknikal di bawah ${MIN_SCORE}, jelaskan bahwa sinyal belum memenuhi ambang. Jika memenuhi, jelaskan alasan BUY/SELL tanpa mengubah data harga.
TECHNICAL=${JSON.stringify(technicalData)}
OHLC=${JSON.stringify(compact)}`;
  try{
    const r=await ai.models.generateContent({model:process.env.GEMINI_MODEL||"gemini-3.8-flash",contents:prompt});
    return {enabled:true,text:r.text||""};
  }catch(e){return {enabled:false,text:"Gemini error: "+e.message}}
}
app.get("/api/config",(q,r)=>r.json({refreshSeconds:REFRESH,minSignalScore:MIN_SCORE,vapidPublicKey:process.env.VAPID_PUBLIC_KEY||null}));
app.get("/api/market",async(req,res)=>{
  try{
    let symbol=req.query.symbol||process.env.DEFAULT_SYMBOL||"XAU/USD";

if (symbol === "XAUUSD") {
  symbol = "XAU/USD";
}
    const interval=req.query.interval||process.env.DEFAULT_INTERVAL||"1min";
    const key=symbol+"|"+interval, now=Date.now(), c=cache.get(key);
    if(c&&now-c.time<REFRESH*1000)return res.json(c.data);
    const bars=await td(symbol,interval), tech=technical(bars), aiData=await geminiAnalysis(symbol,tech,bars);
    const data={symbol,interval,bars,analysis:tech,gemini:aiData,serverTime:new Date().toISOString()};
    cache.set(key,{time:now,data});res.json(data);
  }catch(e){res.status(500).json({error:e.message})}
});
app.post("/api/subscribe",(req,res)=>{if(!req.body?.endpoint)return res.status(400).json({error:"subscription invalid"});subscriptions.set(req.body.endpoint,req.body);res.json({ok:true})});
app.post("/api/push-test",async(req,res)=>{
  const payload=JSON.stringify({title:"QwinAi Trade v5",body:"Notifikasi VAPID aktif."});
  let sent=0;for(const [k,s] of subscriptions){try{await webpush.sendNotification(s,payload);sent++}catch{subscriptions.delete(k)}}
  res.json({sent});
});
app.use((req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`QwinAi Trade v5 : http://localhost:${PORT}`));
