export default async function handler(req, res) {
  const sourceUrl = "https://raw.githubusercontent.com/carlosferrju-bot/carlos-finance/main/index.html?clean_arma=1";
  const upstream = await fetch(sourceUrl, { cache: "no-store" });

  if (!upstream.ok) {
    res.status(502).send("Falha ao carregar o CARLOS FINANCE.");
    return;
  }

  let html = await upstream.text();

  // Migração definitiva do dado legado ARMA.
  // A conta não está gravada no HTML: ela estava no localStorage do navegador
  // como um lançamento parcelado, e o sincronizador transformava esse lançamento
  // novamente em parcelas em "Contas do Mês". Removemos a origem e suas parcelas
  // uma única vez, antes de o aplicativo executar o seu código normal.
  const migration = `
<script>
(function(){
  try{
    const KEY="neonFinanceV1";
    const raw=localStorage.getItem(KEY);
    if(!raw)return;

    const db=JSON.parse(raw);
    if(!db || typeof db!=="object")return;
    if(!Array.isArray(db.transactions))db.transactions=[];
    if(!Array.isArray(db.bills))db.bills=[];

    const norm=v=>String(v??"")
      .normalize("NFKC")
      .replace(/[–—−]/g,"-")
      .replace(/\\s+/g," ")
      .trim()
      .toLocaleLowerCase("pt-BR");

    const isArmaSource=t=>
      t &&
      t.type==="expense" &&
      t.payment!=="credit" &&
      Number(t.installments)===4 &&
      norm(t.desc)==="arma" &&
      String(t.date||"")==="2026-08-24" &&
      Math.abs(Number(t.amount||0)-1750.92)<0.01;

    const armaSources=db.transactions.filter(isArmaSource);
    const armaIds=new Set(armaSources.map(t=>String(t.id)));
    let changed=false;

    // Remove a origem do parcelamento. Sem ela, o sincronizador não consegue
    // recriar nenhuma das quatro parcelas.
    if(armaSources.length){
      const before=db.transactions.length;
      db.transactions=db.transactions.filter(t=>!isArmaSource(t));
      changed=db.transactions.length!==before || changed;
    }

    // Remove todas as parcelas geradas pela origem, inclusive a parcela 1/4
    // que vinha reaparecendo após F5.
    const beforeBills=db.bills.length;
    db.bills=db.bills.filter(b=>{
      if(b && b.fromInstallmentId && armaIds.has(String(b.fromInstallmentId)))return false;

      const desc=norm(b&&b.desc);
      const isLegacyArmaPart=/^arma - parcela [1-4]\\/4$/.test(desc);
      const exactLegacyRow=
        desc==="arma - parcela 1/4" &&
        String(b&&b.due||"")==="2026-08-24" &&
        Math.abs(Number(b&&b.amount||0)-437.73)<0.01;

      return !isLegacyArmaPart && !exactLegacyRow;
    });
    changed=changed || db.bills.length!==beforeBills;

    if(changed){
      localStorage.setItem(KEY,JSON.stringify(db));
    }
  }catch(e){
    console.warn("Migração ARMA:",e);
  }
})();
</script>
`;

  const bodyIndex = html.indexOf("<body>");
  if (bodyIndex === -1) {
    res.status(500).send("Estrutura do CARLOS FINANCE inválida.");
    return;
  }

  const insertAt = bodyIndex + "<body>".length;
  html = html.slice(0, insertAt) + migration + html.slice(insertAt);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.status(200).send(html);
}
