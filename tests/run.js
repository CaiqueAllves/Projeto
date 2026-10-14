// Executor simples: roda cada tests/e2e/*.test.js em sequência e mostra o resultado.
// Cada arquivo exporta { nome, executar(ctx) } — ctx tem browser/page já logado.
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

(async () => {
    const filtro = process.argv[2] || '';
    const arquivos = fs.readdirSync(path.join(__dirname, 'e2e'))
        .filter(f => f.endsWith('.test.js') && f.includes(filtro)).sort();
    const servidor = await h.garantirServidor();
    let ok = 0, falhas = 0, pulados = 0;
    const inicio = Date.now();
    for (const arq of arquivos) {
        const teste = require(path.join(__dirname, 'e2e', arq));
        const t0 = Date.now();
        const { browser, page } = await h.abrirNavegador({ mobile: !!teste.mobile });
        try {
            if (!teste.semLogin) await h.login(page);
            await teste.executar({ page, browser, h });
            ok++;
            console.log(`  ✔ ${teste.nome}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
        } catch (e) {
            if (e instanceof h.PularTeste) {
                pulados++;
                console.log(`  ⚠ ${teste.nome} — pulado: ${e.message}`);
                continue;
            }
            falhas++;
            console.log(`  ✘ ${teste.nome}\n      ${e.message.split('\n')[0]}`);
            try { await teste.limpar?.({ page, h }); } catch {}
        } finally {
            await browser.close();
        }
    }
    console.log(`\n${ok} passaram, ${falhas} falharam, ${pulados} pulados (${((Date.now() - inicio) / 1000).toFixed(0)}s)`);
    if (servidor) servidor.kill();
    process.exit(falhas ? 1 : 0);
})();
