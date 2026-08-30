export default async function handler(req, res) {
  const sourceUrl = "https://raw.githubusercontent.com/carlosferrju-bot/carlos-finance/main/index.html?arma_guard=8";
  const upstream = await fetch(sourceUrl, { cache: "no-store" });

  if (!upstream.ok) {
    res.status(502).send("Falha ao carregar o CARLOS FINANCE.");
    return;
  }

  let html = await upstream.text();

  const marker = "/* PERMANENT_LEGACY_ARMA_GUARD_V8 */";
  if (!html.includes(marker)) {
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
    db.bills=db.bills.filter(b=>!blockedArmaBill(b));
  }

  // Remove the legacy record immediately and make save() the authoritative
  // persistence boundary so synchronization can never write it back.
  purgeBlockedArmaBill();
  const originalSave=save;
  save=function(){
    purgeBlockedArmaBill();
    return originalSave.apply(this,arguments);
  };

  // Keep any automatic backup created by the app clean as well.
  const originalSaveInternalBackup=saveInternalBackup;
  saveInternalBackup=async function(){
    purgeBlockedArmaBill();
    return originalSaveInternalBackup.apply(this,arguments);
  };

  const originalWriteFileBackup=writeFileBackup;
  writeFileBackup=async function(){
    purgeBlockedArmaBill();
    return originalWriteFileBackup.apply(this,arguments);
  };

  purgeBlockedArmaBill();
})();
`;

    const scriptEnd = html.lastIndexOf("</script>");
    if (scriptEnd === -1) {
      res.status(500).send("Estrutura do CARLOS FINANCE inválida.");
      return;
    }

    html = html.slice(0, scriptEnd) + guard + html.slice(scriptEnd);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(html);
}
