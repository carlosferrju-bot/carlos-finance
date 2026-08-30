export default async function handler(req, res) {
  const sourceUrl = "https://raw.githubusercontent.com/carlosferrju-bot/carlos-finance/main/index.html?arma_guard=12";
  const upstream = await fetch(sourceUrl, { cache: "no-store" });

  if (!upstream.ok) {
    res.status(502).send("Falha ao carregar o CARLOS FINANCE.");
    return;
  }

  let html = await upstream.text();

  // Executa ANTES do aplicativo ler o localStorage. Isso impede que a conta
  // ARMA seja recriada durante o ciclo de inicialização/renderização.
  const preloadGuard = `
<script>
(function(){
  try{
    const KEY="neonFinanceV1";
    const raw=localStorage.getItem(KEY);
    if(!raw)return;
    const db=JSON.parse(raw);
    if(!db||typeof db!=="object")return;
    if(!Array.isArray(db.bills))db.bills=[];
    if(!Array.isArray(db.transactions))db.transactions=[];
    if(!Array.isArray(db.deletedInstallmentBills))db.deletedInstallmentBills=[];
    if(!Array.isArray(db.deletedBillSignatures))db.deletedBillSignatures=[];

    const norm=v=>String(v||"").normalize("NFKC").replace(/[–—−]/g,"-").replace(/\\s+/g," ").trim().toLocaleLowerCase("pt-BR");
    const target=b=>b && b.paid!==true && norm(b.desc)==="arma - parcela 1/4" && String(b.due||"")==="2026-08-24" && Math.abs(Number(b.amount||0)-437.73)<0.005;

    const source=db.transactions.find(t=>t && t.type==="expense" && t.payment!=="credit" && Number(t.installments)===4 && norm(t.desc)==="arma" && String(t.date||"")==="2026-08-24");
    if(source){
      const key=source.id+"|1";
      if(!db.deletedInstallmentBills.includes(key))db.deletedInstallmentBills.push(key);
      const sourceSig="installment-source|"+key;
      if(!db.deletedBillSignatures.includes(sourceSig))db.deletedBillSignatures.push(sourceSig);
    }

    const before=db.bills.length;
    db.bills=db.bills.filter(b=>!target(b));
    if(db.bills.length!==before || source){
      localStorage.setItem(KEY,JSON.stringify(db));
    }
  }catch(e){ console.warn("ARMA preload guard:",e); }
})();
</script>
`;

  // Coloca o guard no início do body, antes do markup/app e antes do script principal.
  const bodyIndex = html.indexOf("<body>");
  if (bodyIndex === -1) {
    res.status(500).send("Estrutura do CARLOS FINANCE inválida.");
    return;
  }
  const insertAt = bodyIndex + "<body>".length;
  html = html.slice(0, insertAt) + preloadGuard + html.slice(insertAt);

  // Guard final: depois que o aplicativo terminar de sincronizar, remove a
  // mesma conta caso alguma rotina de compatibilidade tenha recriado a linha.
  const finalGuard = `
/* PERMANENT_LEGACY_ARMA_GUARD_V12 */
(function(){
  function blockedArmaBill(b){
    if(!b || b.paid===true) return false;
    const norm=v=>String(v||"").normalize("NFKC").replace(/[–—−]/g,"-").replace(/\\s+/g," ").trim().toLocaleLowerCase("pt-BR");
    return norm(b.desc)==="arma - parcela 1/4" && String(b.due||"")==="2026-08-24" && Math.abs(Number(b.amount||0)-437.73)<0.005;
  }
  function tombstone(){
    if(!Array.isArray(db.deletedInstallmentBills))db.deletedInstallmentBills=[];
    if(!Array.isArray(db.deletedBillSignatures))db.deletedBillSignatures=[];
    const source=db.transactions && db.transactions.find(t=>t && t.type==="expense" && t.payment!=="credit" && Number(t.installments)===4 && String(t.date||"")==="2026-08-24" && String(t.desc||"").trim().toLocaleLowerCase("pt-BR")==="arma");
    if(source){
      const key=source.id+"|1";
      if(!db.deletedInstallmentBills.includes(key))db.deletedInstallmentBills.push(key);
      const ss="installment-source|"+key;
      if(!db.deletedBillSignatures.includes(ss))db.deletedBillSignatures.push(ss);
    }
    const before=db.bills.length;
    db.bills=db.bills.filter(b=>!blockedArmaBill(b));
    return db.bills.length!==before;
  }
  const oldSync=typeof syncInstallmentExpensesToBills==="function"?syncInstallmentExpensesToBills:null;
  if(oldSync){
    syncInstallmentExpensesToBills=function(){
      oldSync.apply(this,arguments);
      tombstone();
    };
  }
  const oldSave=save;
  save=function(){
    tombstone();
    return oldSave.apply(this,arguments);
  };
  if(tombstone()) oldSave();
})();
`;
  const scriptEnd = html.lastIndexOf("</script>");
  if (scriptEnd === -1) {
    res.status(500).send("Estrutura do CARLOS FINANCE inválida.");
    return;
  }
  html = html.slice(0, scriptEnd) + finalGuard + html.slice(scriptEnd);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.status(200).send(html);
}
