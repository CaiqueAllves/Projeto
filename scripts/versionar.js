// Versão automática dos arquivos (cache do navegador / GitHub Pages)
//
// Reescreve, em todos os .html da raiz, as referências a .js/.css locais para
// "arquivo.js?v=<hash do conteúdo>". Quando um arquivo muda, o hash muda e o
// navegador baixa a versão nova; arquivo que não mudou continua em cache.
//
// Rodar antes de cada commit/publicação:   node scripts/versionar.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raiz = path.resolve(__dirname, '..');
const cache = {};
const hash = arq => {
    if (!(arq in cache)) {
        const p = path.join(raiz, arq);
        cache[arq] = fs.existsSync(p) ? crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 8) : null;
    }
    return cache[arq];
};

let paginas = 0, refs = 0;
for (const html of fs.readdirSync(raiz).filter(f => f.endsWith('.html'))) {
    const caminho = path.join(raiz, html);
    const antes = fs.readFileSync(caminho, 'utf8');
    // src="x.js" / href="x.css" locais (sem http, sem barra inicial), com ou sem ?v= anterior
    const depois = antes.replace(/(\b(?:src|href)=")([\w\-./]+\.(?:js|css))(?:\?v=[^"]*)?(")/g, (m, a, arq, z) => {
        if (/^(https?:)?\/\//.test(arq)) return m;
        const h = hash(arq);
        if (!h) return m;
        refs++;
        return `${a}${arq}?v=${h}${z}`;
    });
    if (depois !== antes) { fs.writeFileSync(caminho, depois); paginas++; }
}
console.log(`versionar: ${refs} referências conferidas, ${paginas} página(s) atualizada(s).`);
