export default async function handler(req, res) {
  const sourceUrl = "https://raw.githubusercontent.com/carlosferrju-bot/carlos-finance/main/index.html?arma_guard=11";
  const upstream = await fetch(sourceUrl, { cache: "no-store" });

  if (!upstream.ok) {
    res.status(502).send("Falha ao carregar o CARLOS FINANCE.");
    return;
  }

  let html = await upstream.text();

  const marker = "/* PERMANENT_LEGACY_ARMA_GUARD_V11 */";
  const guard = `
${marker}
(function(){
  function blockedArmaBill(b){
    if(!b) return false;
    const norm=v=>String(v||"").normalize("NFKC").replace(/[–—−]/g,"-").replace(/\\s+/g," ").trim().toLocaleLowerCase("pt-BR");
    return norm(b.desc)==="arma - parcela 1/4"
      && String(b.due||"")==="2026-08-24"
      && Math.abs(Number(b.amount||0)-437.73)<0.005;
  }

  function purgeBlockedArmaBill(){
    if(!Array.isArray(db.bills)) db.bills=[];
    const before=db.bills.length;
    db.bills=db.bills.filter(b=>!blockedArmaBill(b));
    return db.bills.length!==before;
  }

  if(typeof syncInstallmentExpensesToBills==="function"){
    const originalSyncInstallments=syncInstallmentExpensesToBills;
    syncInstallmentExpensesToBills=function(){
      const result=originalSyncInstallments.apply(this,arguments);
      purgeBlockedArmaBill();
      return result;
    };
  }

  const originalSave=save;
  save=function(){
    purgeBlockedArmaBill();
    return originalSave.apply(this,arguments);
  };

  if(typeof saveInternalBackup==="function"){
    const originalSaveInternalBackup=saveInternalBackup;
    saveInternalBackup=async function(){
      purgeBlockedArmaBill();
      return originalSaveInternalBackup.apply(this,arguments);
    };
  }

  if(typeof writeFileBackup==="function"){
    const originalWriteFileBackup=writeFileBackup;
    writeFileBackup=async function(){
      purgeBlockedArmaBill();
      return originalWriteFileBackup.apply(this,arguments);
    };
  }

  /*
   * O erro da versão anterior era simples, mas importante: a linha era
   * removida do banco depois que render() já havia desenhado a tabela.
   * Agora, quando a purga altera os dados, renderizamos novamente a tela.
   */
  const removed=purgeBlockedArmaBill();
  if(removed){
    originalSave();
    if(typeof render==="function") render();
  }

  if(!window.__carlosFinanceSWRegistered && "serviceWorker" in navigator){
    window.__carlosFinanceSWRegistered=true;
    navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{});
  }
})();
`;

  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptEnd === -1) {
    res.status(500).send("Estrutura do CARLOS FINANCE inválida.");
    return;
  }

  html = html.slice(0, scriptEnd) + guard + html.slice(scriptEnd);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.status(200).send(html);
}
