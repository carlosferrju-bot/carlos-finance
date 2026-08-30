/* CARLOS FINANCE — INSTALLMENT EDIT PERSISTENCE FIX */
(function(){
  'use strict';

  function ensureMap(){
    if(!db.installmentManualValues || typeof db.installmentManualValues !== 'object'){
      db.installmentManualValues = {};
    }
    return db.installmentManualValues;
  }

  function keyForBill(b){
    if(!b || !b.fromInstallmentId || !Number(b.installmentNumber)) return '';
    return b.fromInstallmentId + '|' + Number(b.installmentNumber);
  }

  function applyManualInstallmentValues(){
    const map = ensureMap();
    (db.bills || []).forEach(b=>{
      const key = keyForBill(b);
      if(!key || !Object.prototype.hasOwnProperty.call(map,key)) return;
      const value = Number(map[key]);
      if(!Number.isFinite(value) || value < 0.01) return;
      b.amount = value;
      b.manualAmount = value;
      b.manualEdit = true;
      b.installmentManualEdit = true;
    });
  }

  const originalSync = window.syncInstallmentExpensesToBills;
  if(typeof originalSync === 'function'){
    window.syncInstallmentExpensesToBills = function(){
      originalSync();
      applyManualInstallmentValues();
    };
  }

  const originalEditBill = window.editBill;
  window.editBill = function(id){
    const b = (db.bills || []).find(v=>v.id===id);
    if(!b) return;

    if(b.fromInstallmentId && Number(b.installmentNumber)>0){
      const oldAmount = Number(b.amount || 0);
      const fields = [
        {label:'Descrição', html:`<input name="desc" value="${esc(b.desc||'')}" required>`},
        {label:'Valor da parcela', html:`<input name="amount" type="number" step="0.01" min="0.01" value="${oldAmount.toFixed(2)}" required>`},
        {label:'Vencimento', html:`<input name="due" type="date" value="${b.due||''}" required>`},
        {label:'Observação', html:`<input name="note" value="${esc(b.note||'')}">`}
      ];

      openEditModal('Editar parcela', fields, form=>{
        const newAmount = Number(form.amount.value);
        if(!Number.isFinite(newAmount) || newAmount < 0.01){
          toast('Informe um valor válido.');
          return;
        }

        const key = keyForBill(b);
        const map = ensureMap();
        map[key] = newAmount;

        b.desc = form.desc.value.trim();
        b.amount = newAmount;
        b.manualAmount = newAmount;
        b.manualEdit = true;
        b.installmentManualEdit = true;
        b.due = form.due.value;
        b.note = form.note.value;

        if(Array.isArray(db.deletedBillSignatures)){
          const sourceSig = 'installment-source|' + b.fromInstallmentId + '|' + Number(b.installmentNumber);
          db.deletedBillSignatures = db.deletedBillSignatures.filter(s=>s!==sourceSig);
        }
        if(Array.isArray(db.deletedInstallmentBills)){
          db.deletedInstallmentBills = db.deletedInstallmentBills.filter(k=>k!==key);
        }

        save();
        closeEditModal();
        render();
        toast(`Parcela ${b.installmentNumber}/${b.installmentTotal||''} salva em ${money(newAmount)}.`);
      });
      return;
    }

    if(typeof originalEditBill === 'function') return originalEditBill(id);
  };

  applyManualInstallmentValues();
})();
