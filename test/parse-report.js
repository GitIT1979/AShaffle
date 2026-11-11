const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('AShaffle.html','utf8');
let code=html.match(/<script>([\s\S]*?)<\/script>/)[1];
code=code.replace(/\}\)\(\);\s*$/, "globalThis.__a={parseTrackInfo:parseTrackInfo};})();");
const el=()=>({textContent:'',innerHTML:'',style:{},dataset:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []},setAttribute(){},removeAttribute(){},getAttribute(){return null}});
const els={};
const document={getElementById(id){return els[id]||(els[id]=el())},createElement(){return el()},body:el(),documentElement:{setAttribute(){},removeAttribute(){},getAttribute(){return null}}};
const sb={console,setTimeout,clearTimeout,TextEncoder,TextDecoder,Blob,File,URL,AbortController,fetch,document,location:{protocol:'https:'},localStorage:{getItem(){return null},setItem(){}},navigator:{}};
sb.window=sb; sb.globalThis=sb; sb.self=sb;
vm.createContext(sb); vm.runInContext(code, sb);
const dir='C:\\Users\\User\\Desktop\\Музыка на НГ';
let bad=[];
for(const f of fs.readdirSync(dir).filter(x=>x.toLowerCase().endsWith('.mp3'))){
  const p=sb.__a.parseTrackInfo(f);
  const emptyArtist = !p.artist;
  const junk = p.title === 'unknown_track';
  if(emptyArtist || junk) bad.push([f, p.artist, p.title, junk?'JUNK':'no-artist']);
}
console.log('файлов:', fs.readdirSync(dir).filter(x=>x.toLowerCase().endsWith('.mp3')).length, '| без исполнителя или с мусором:', bad.length);
for(const b of bad) console.log(' ', b[0].slice(0,80), '=>', JSON.stringify(b[1]), '|', JSON.stringify(b[2]));
