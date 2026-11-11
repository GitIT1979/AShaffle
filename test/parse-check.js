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
const want=["Egor","Clean-Bandit","Robin-Schulz","SAINt","TV","Vиктор","AQF","nai","ney","lesnik","Bohemian","Kings","Body To Body","august","seorita","Clandestina","Daft","technology","Nautilus","Ally-Brooke"];
const dir='C:\\Users\\User\\Desktop\\Музыка на НГ';
for(const f of fs.readdirSync(dir).filter(x=>x.toLowerCase().endsWith('.mp3'))){
  if(!want.some(w=>f.includes(w))) continue;
  const p=sb.__a.parseTrackInfo(f);
  console.log(f.padEnd(70).slice(0,70), '=>', JSON.stringify(p.artist), '|', JSON.stringify(p.title));
}
