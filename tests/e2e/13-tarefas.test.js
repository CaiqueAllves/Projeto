// Tarefas do Início: criar, persistir após recarregar, concluir e excluir.
module.exports = {
    nome: 'Tarefas do Início',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 3500);
        const titulo = 'TSTE2E tarefa ' + Date.now();
        await page.evaluate(() => adicionarTarefa());
        await page.fill('#tarefaTitulo', titulo);
        await page.evaluate(() => salvarTarefa());
        await page.waitForTimeout(1500);
        await page.reload(); await page.waitForTimeout(4000);
        const t = await page.evaluate((titulo) => tarefas.find(x => x.titulo === titulo), titulo);
        h.esperar(t, 'Tarefa sumiu depois de recarregar a página');
        await page.evaluate((id) => toggleTarefa(id), t.id); await page.waitForTimeout(800);
        h.esperar(await page.evaluate((id) => tarefas.find(x => x.id === id)?.concluida, t.id), 'Tarefa não ficou concluída');
        await page.evaluate((id) => deletarTarefa(id), t.id); await page.waitForTimeout(800);
        h.esperar(!(await page.evaluate((id) => tarefas.some(x => x.id === id), t.id)), 'Tarefa não foi excluída');
        h.semErrosJS(page);
    },
};
