const fs=require('fs');
const encU=(s)=>new TextEncoder().encode(s);
const le32=(n)=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
const be32=(n)=>new Uint8Array([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]);
const concat=(...a)=>{const l=a.reduce((s,x)=>s+x.length,0);const o=new Uint8Array(l);let p=0;for(const x of a){o.set(x,p);p+=x.length}return o};
function writeM4a(path){
  const typ=(s)=>new Uint8Array([...s].map(c=>c.charCodeAt(0)));
  const atomB=(t,p)=>{const size=8+p.length;return concat(new Uint8Array([(size>>>24)&255,(size>>>16)&255,(size>>>8)&255,size&255]),t,p)};
  const dataAtom=(text)=>atomB(typ('data'),concat(new Uint8Array([0,0,0,1,0,0,0,0]),encU(text)));
  const ilst=atomB(typ('ilst'),concat(
    atomB(new Uint8Array([0xA9,0x6E,0x61,0x6D]),dataAtom('Тест m4a')),
    atomB(new Uint8Array([0xA9,0x41,0x52,0x54]),dataAtom('Артист M4A'))
  ));
  const mp4=concat(
    atomB(typ('ftyp'),encU('M4A \u0000\u0000\u0002\u0000')),
    atomB(typ('moov'),atomB(typ('udta'),atomB(typ('meta'),concat(new Uint8Array([0,0,0,0]),ilst))))
  );
  fs.writeFileSync(path, Buffer.from(mp4));
}
function writeOgg(path){
  const page=(payload,seq,htype)=>concat(encU('OggS'),new Uint8Array([0,htype]),new Uint8Array(8),new Uint8Array(4),le32(seq),new Uint8Array(4),new Uint8Array([1,payload.length]),payload);
  const id=concat(new Uint8Array([1]),encU('vorbis'),new Uint8Array(23));
  const f1=encU('TITLE=Тест ogg'), f2=encU('ARTIST=Артист Ogg');
  const comment=concat(new Uint8Array([3]),encU('vorbis'),new Uint8Array(4),le32(2),le32(f1.length),f1,le32(f2.length),f2);
  fs.writeFileSync(path, Buffer.from(concat(page(id,0,2),page(comment,1,0))));
}
writeM4a('test/tmp/example.m4a');
writeOgg('test/tmp/example.ogg');
console.log('ok', fs.statSync('test/tmp/example.m4a').size, fs.statSync('test/tmp/example.ogg').size);
