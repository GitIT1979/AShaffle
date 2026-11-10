const fs=require('fs');
const encU=(s)=>new TextEncoder().encode(s);
const le32=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
const le16=(n)=>new Uint8Array([n&255,(n>>>8)&255]);
const le64=(n)=>{const a=new Uint8Array(8);let m=n;for(let i=0;i<8;i++){a[i]=m&255;m=Math.floor(m/256)}return a};
const u16=(s)=>{const a=new Uint8Array(s.length*2);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a[i*2]=c&255;a[i*2+1]=c>>8}return a};
const guid=(hex)=>new Uint8Array(hex.match(/../g).map(h=>parseInt(h,16)));
const concat=(...a)=>{const l=a.reduce((s,x)=>s+x.length,0);const o=new Uint8Array(l);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};

function writeM4a(path){
  const typ=(s)=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
  const atomB=(t,p)=>{const size=8+p.length;return concat(new Uint8Array([(size>>>24)&255,(size>>>16)&255,(size>>>8)&255,size&255]),t,p)};
  const dataAtom=(text)=>atomB(typ('data'),concat(new Uint8Array([0,0,0,1,0,0,0,0]),encU(text)));
  const ilst=atomB(typ('ilst'),concat(
    atomB(new Uint8Array([0xA9,0x6E,0x61,0x6D]),dataAtom('Тест m4a')),
    atomB(new Uint8Array([0xA9,0x41,0x52,0x54]),dataAtom('Артист M4A'))
  ));
  const mp4=concat(atomB(typ('ftyp'),encU('M4A \u0000\u0000\u0002\u0000')),
    atomB(typ('moov'),atomB(typ('udta'),atomB(typ('meta'),concat(new Uint8Array([0,0,0,0]),ilst)))));
  fs.writeFileSync(path, Buffer.from(mp4));
}
function writeOgg(path){
  const page=(payload,seq,htype)=>concat(encU('OggS'),new Uint8Array([0,htype]),new Uint8Array(8),new Uint8Array(4),le32(seq),new Uint8Array(4),new Uint8Array([1,payload.length]),payload);
  const id=concat(new Uint8Array([1]),encU('vorbis'),new Uint8Array(23));
  const f1=encU('TITLE=Тест ogg'), f2=encU('ARTIST=Артист Ogg');
  const comment=concat(new Uint8Array([3]),encU('vorbis'),new Uint8Array(4),le32(2),le32(f1.length),f1,le32(f2.length),f2);
  fs.writeFileSync(path, Buffer.from(concat(page(id,0,2),page(comment,1,0))));
}
function writeApe(path){
  const item=(k,v)=>concat(le32(v.length),le32(0),encU(k),new Uint8Array([0]),v);
  const items=concat(item('Title',encU('Тест ape')),item('Artist',encU('Артист APE')));
  const footer=concat(encU('APETAGEX'),le32(2000),le32(items.length+32),le32(2),le32(0),new Uint8Array(8));
  fs.writeFileSync(path, Buffer.from(concat(new Uint8Array(200),items,footer)));
}
function writeWma(path){
  const t=u16('Тест wma'), a=u16('Артист WMA');
  const cd=concat(le16(t.length),le16(a.length),le16(0),le16(0),le16(0),t,a);
  const obj=concat(guid('3326b2758e66cf11a6d900aa0062ce6c'),le64(24+cd.length),cd);
  const hsize=30+obj.length;
  const wma=concat(guid('3026b2758e66cf11a6d900aa0062ce6c'),le64(hsize),le32(1),new Uint8Array(2),obj,new Uint8Array(64));
  fs.writeFileSync(path, Buffer.from(wma));
}
writeM4a('test/tmp/example.m4a');
writeOgg('test/tmp/example.ogg');
writeApe('test/tmp/example.ape');
writeWma('test/tmp/example.wma');
console.log('ok');
