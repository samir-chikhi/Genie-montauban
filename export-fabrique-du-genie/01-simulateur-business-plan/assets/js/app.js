/* Interface du simulateur. Le calcul est dans engine.js. */

var PAS=[
 {g:"Comprendre",n:"Idée et fiche projet"},{g:"",n:"Offre, clients et prix"},{g:"",n:"Acquisition et ventes"},
 {g:"Chiffrer",n:"Ressources et charges"},{g:"",n:"Investissements et financements"},{g:"",n:"Cadre français"},{g:"",n:"Prévision mensuelle et annuelle"},
 {g:"Tester",n:"Scénarios et sensibilité"},
 {g:"Livrer",n:"Rédaction assistée"},{g:"",n:"Validation conseiller"},{g:"",n:"Export"},{g:"Piloter",n:"Suivi plan / réel"}
];
var H=Engine.clone(Engine.DEFAUT);
var etape=0, fait={}, REEL=[1500,1700,1900,2100,2300,2500];
var calc=Engine.calc;
var fr=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
function eur(n){return fr.format(Math.round(n)).replace(/ | /g,' ')+' €'}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

/* lecture directe */
function direct(){
  var c=calc(H),r=Engine.robustesse(c,H);
  document.getElementById('d-nom').textContent=H.nom||'Votre prévisionnel';
  document.getElementById('kpis').innerHTML=
   k('CA année 1',eur(c.an[0].ca))+k('Résultat année 1',eur(c.an[0].res),c.an[0].res<0)+
   k('Trésorerie au plus bas',eur(c.minT),c.minT<0)+k('Équilibre',c.eq?'Mois '+c.eq:'Non atteint',!c.eq)+
   k('Seuil de rentabilité',isFinite(c.seuil)?eur(c.seuil)+' /mois':'Hors d\'atteinte',!isFinite(c.seuil))+k('Clients au seuil',isFinite(c.seuil)?fr.format(Math.ceil(c.seuilCl))+' /mois':'—',!isFinite(c.seuil));
  document.getElementById('d-score').textContent=r.score;
  document.getElementById('d-score-txt').textContent=r.score>=75?'Robustesse correcte : le plan résiste aux alertes principales.':r.score>=50?'Plan fragile : corrigez les alertes avant de le présenter.':'Plan à reconstruire : plusieurs alertes bloquantes.';
  function k(l,v,neg){return '<div class="kpi"><small>'+l+'</small><b'+(neg?' class="neg"':'')+'>'+v+'</b></div>'}
}

/* graphique à l'échelle */
function courbes(series,mois){
  var W=640,Hh=260,pl=56,pr=12,pt=14,pb=28,all=[];
  series.forEach(function(s){s.v.forEach(function(x){all.push(x)})});
  var lo=Math.min(0,Math.min.apply(null,all)),hi=Math.max(0,Math.max.apply(null,all));
  var step=niceStep((hi-lo)/4);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  function X(i){return pl+(W-pl-pr)*i/(mois-1)}function Y(v){return pt+(Hh-pt-pb)*(1-(v-lo)/(hi-lo))}
  var g='';for(var v=lo;v<=hi+1e-6;v+=step){g+='<line x1="'+pl+'" x2="'+(W-pr)+'" y1="'+Y(v)+'" y2="'+Y(v)+'" stroke="'+(v===0?'#1C2B3A':'rgba(28,43,58,.12)')+'" stroke-width="'+(v===0?1.4:1)+'"/><text x="'+(pl-8)+'" y="'+(Y(v)+4)+'" text-anchor="end">'+fr.format(v/1000)+' k€</text>'}
  [1,6,12,18,24,30,36].filter(function(m){return m<=mois}).forEach(function(m){g+='<text x="'+X(m-1)+'" y="'+(Hh-8)+'" text-anchor="middle">M'+m+'</text>'});
  var p=series.map(function(s){return '<polyline fill="none" stroke="'+s.c+'" stroke-width="'+(s.w||2.2)+'" stroke-linejoin="round" points="'+s.v.map(function(x,i){return X(i).toFixed(1)+','+Y(x).toFixed(1)}).join(' ')+'"/>'}).join('');
  return '<svg class="chart" viewBox="0 0 '+W+' '+Hh+'" role="img" aria-label="Trésorerie cumulée sur '+mois+' mois">'+g+p+'</svg>'+
   '<div class="leg">'+series.map(function(s){return '<span><i style="background:'+s.c+'"></i>'+s.n+'</span>'}).join('')+'</div>'
}
function niceStep(x){var e=Math.pow(10,Math.floor(Math.log10(x||1))),f=x/e;return (f<=1?1:f<=2?2:f<=5?5:10)*e}

/* champs */
function ch(id,label,unit,aide,type){
  var v=H[id];
  return '<div class="champ"><label for="h-'+id+'">'+label+'</label><div class="unite"><input id="h-'+id+'" type="number" inputmode="decimal" step="any" min="0" value="'+v+'" data-h="'+id+'"><em>'+unit+'</em></div>'+(aide?'<span class="aide">'+aide+'</span>':'')+'<span class="origine">Saisi par vous</span></div>'}
function nav(){return '<div class="nav-etape"><button class="btn btn-line" '+(etape===0?'disabled':'')+' data-go="'+(etape-1)+'"><svg class="ico"><use href="#i-retour"/></svg>Étape précédente</button>'+(etape<11?'<button class="btn btn-gold" data-go="'+(etape+1)+'">Étape suivante<svg class="ico"><use href="#i-fleche"/></svg></button>':'<span class="pil ok"><svg class="ico"><use href="#i-coche"/></svg>Parcours terminé</span>')+'</div>'}

/* étapes */
var VUES=[
function(){return '<div class="grille" style="grid-template-columns:1fr"><div class="champ"><label for="h-nom">Nom du projet</label><input id="h-nom" type="text" value="'+esc(H.nom)+'" data-t="nom"></div><div class="champ"><label for="h-desc">Décrivez votre projet en quelques phrases</label><textarea id="h-desc" data-t="desc">'+esc(H.desc)+'</textarea><span class="aide">Dans la version finale, l\'assistant propose des hypothèses chiffrées à partir de ce texte. Vous validez ou corrigez chacune.</span></div></div>'},
function(){return '<div class="grille">'+ch('prix','Prix moyen par client','€','Panier moyen d\'une intervention ou d\'une vente.')+'</div><p class="note">Un seul produit ici pour la maquette. La version complète gère plusieurs produits et services par canal.</p>'},
function(){return '<div class="grille">'+ch('clients0','Clients le premier mois','clients','Ce que vous pouvez raisonnablement servir au lancement.')+ch('croiss','Croissance mensuelle','% /mois','Hausse du nombre de clients chaque mois.')+ch('plafond','Capacité maximale','clients /mois','Le plus que vous puissiez servir avec vos moyens.')+'</div>'},
function(){return '<div class="grille">'+ch('achats','Achats liés aux ventes','% du CA','Pièces, consommables, sous-traitance.')+ch('loyer','Loyer et charges du local','€ /mois','Bureau, atelier ou espace de travail partagé.')+ch('autres','Autres charges fixes','€ /mois','Assurance, logiciels, téléphone, comptable.')+ch('salaire','Rémunération du porteur','€ /mois','Ce que vous vous versez, charges incluses.')+'</div>'},
function(){return '<div class="grille">'+ch('invest','Investissements de départ','€','Matériel, aménagement, stock initial.')+ch('apport','Apport personnel','€','Épargne ou apport associatif.')+ch('pret','Prêt bancaire','€','Montant demandé.')+ch('taux','Taux du prêt','% /an','')+ch('duree','Durée du prêt','mois','')+'</div><p class="note">Un prêt d\'honneur ou une subvention s\'ajoute en apport. Retrouvez-les avec l\'<a href="#">outil Aides</a>.</p>'},
function(){return '<div class="grille"><div class="champ"><label for="h-tva">TVA</label><select id="h-tva" data-t="tva"><option value="franchise"'+(H.tva==='franchise'?' selected':'')+'>Franchise en base</option><option value="assujetti"'+(H.tva==='assujetti'?' selected':'')+'>Assujetti</option></select><span class="aide">Dans cette maquette, la TVA n\'est pas encore intégrée aux calculs.</span></div>'+ch('cotis','Taux de cotisations sociales','% du CA','Paramètre d\'exemple. Il dépend du statut et se valide avec l\'expert-comptable.')+'</div><div class="alerte warn"><svg class="ico"><use href="#i-alerte"/></svg><div><b>Règles à valider</b>Les taux fiscaux et sociaux sont des paramètres, pas du conseil. Ils sont réglables et datés dans la version finale.</div></div>'},
function(){var c=calc(H),y=c.rows.slice(0,12);
  var th='<tr><th>Mois</th>'+y.map(function(r){return '<th>M'+r.m+'</th>'}).join('')+'</tr>';
  function tr(l,k,cls){return '<tr'+(cls?' class="'+cls+'"':'')+'><td>'+l+'</td>'+y.map(function(r){var v=r[k];return '<td'+(v<0?' class="neg"':'')+'>'+fr.format(Math.round(v)).replace(/ /g,' ')+'</td>'}).join('')+'</tr>'}
  var an='<tr><th>Par année</th><th>Année 1</th><th>Année 2</th><th>Année 3</th></tr>'+[['Chiffre d\'affaires','ca'],['Résultat','res'],['Trésorerie fin d\'année','tre']].map(function(x){return '<tr><td>'+x[0]+'</td>'+c.an.map(function(a){return '<td'+(a[x[1]]<0?' class="neg"':'')+'>'+eur(a[x[1]])+'</td>'}).join('')+'</tr>'}).join('');
  return '<h3>Trésorerie cumulée sur 3 ans</h3>'+courbes([{n:'Trésorerie',c:'#B4532F',v:c.rows.map(function(r){return r.tre})}],36)+
   '<h3 style="margin-top:22px">Année 1, mois par mois (en €)</h3><div class="tw" tabindex="0"><table><thead>'+th+'</thead><tbody>'+tr('Clients','cl')+tr('Chiffre d\'affaires','ca')+tr('Achats','ach')+tr('Charges fixes','fix')+tr('Cotisations','cot')+tr('Résultat','res','tot')+tr('Trésorerie cumulée','tre','tot')+'</tbody></table></div>'+
   '<h3>Synthèse annuelle</h3><div class="tw"><table><tbody>'+an+'</tbody></table></div><p class="note">Mensualité du prêt : '+eur(c.mens)+'. Chaque ligne se déduit des hypothèses saisies aux étapes 1 à 6.</p>'},
function(){var S=['prudent','central','ambitieux'],N={prudent:'Prudent',central:'Central',ambitieux:'Ambitieux'},C={prudent:'#B4532F',central:'#1C2B3A',ambitieux:'#2F6B4F'};
  var cs=S.map(function(k){return{k:k,c:calc(Engine.scen(H,k))}});
  var sens=Engine.sensibilite(H),mx=sens[0].d||1;
  return '<h3>Trois scénarios</h3><div class="scen">'+cs.map(function(x){var r=Engine.robustesse(x.c,H);return '<div><small>'+N[x.k]+'</small><b>'+eur(x.c.an[0].ca)+'</b><small>CA année 1</small><p style="margin:8px 0 0;font-size:.9rem">Trésorerie au plus bas : <b style="display:inline;font:700 .95rem var(--texte)" class="'+(x.c.minT<0?'neg':'')+'">'+eur(x.c.minT)+'</b><br>Robustesse : '+r.score+' / 100</p></div>'}).join('')+'</div>'+
   courbes(cs.map(function(x){return{n:N[x.k],c:C[x.k],v:x.c.rows.map(function(r){return r.tre}),w:x.k==='central'?3:2}}),36)+
   '<h3 style="margin-top:24px">Ce qui pèse le plus sur la trésorerie</h3><p class="note">Effet d\'une variation de 10 % de chaque hypothèse sur la trésorerie en fin d\'année 1.</p><div class="tornado">'+sens.map(function(s){return '<div class="tl"><span>'+s.n+'</span><span class="bar"><i style="width:'+Math.max(3,s.d/mx*100)+'%"></i></span><span>± '+eur(s.d)+'</span></div>'}).join('')+'</div>'},
function(){var c=calc(H),a=c.an[0];
  return '<div class="recit"><p><b>'+esc(H.nom)+'</b> propose : '+esc(H.desc)+'</p>'+
  '<p>Le projet vise <mark>'+fr.format(H.clients0)+' clients</mark> le premier mois, pour un panier moyen de <mark>'+eur(H.prix)+'</mark>, avec une croissance de <mark>'+H.croiss+' % par mois</mark>. Le chiffre d\'affaires de la première année s\'élève à <mark>'+eur(a.ca)+'</mark> et le résultat à <mark>'+eur(a.res)+'</mark>.</p>'+
  '<p>Le démarrage est financé par un apport de <mark>'+eur(H.apport)+'</mark> et un prêt de <mark>'+eur(H.pret)+'</mark> sur '+H.duree+' mois. '+(c.minT<0?'La trésorerie passe sous zéro au mois '+c.minM+' ; ce point doit être traité avant le dépôt du dossier.':'La trésorerie reste positive, avec un point bas de <mark>'+eur(c.minT)+'</mark> au mois '+c.minM+'.')+'</p>'+
  (isFinite(c.seuil)?'<p>Le seuil de rentabilité est de <mark>'+eur(c.seuil)+'</mark> de chiffre d\'affaires par mois, soit environ <mark>'+Math.ceil(c.seuilCl)+' clients</mark>.</p>':'<p>Le seuil de rentabilité n\'est pas atteignable avec ces hypothèses.</p>')+'</div>'+
  '<p class="note">Ce texte est généré à partir des chiffres validés. Si vous changez une hypothèse, il se réécrit. Les passages surlignés viennent du moteur de calcul et non d\'une IA.</p>'},
function(){var r=Engine.robustesse(calc(H),H);
  return '<h3>Alertes automatiques</h3><div class="alertes">'+r.al.map(function(a){var t=texteAlerte(a);return '<div class="alerte '+a.n+'"><svg class="ico"><use href="#i-'+(a.n==='ok'?'coche':'alerte')+'"/></svg><div><b>'+t[0]+'</b>'+t[1]+'</div></div>'}).join('')+'</div>'+
  '<h3>Relecture par un conseiller</h3><ul class="liste-ck"><li><label><input type="checkbox"> Les hypothèses de ventes sont cohérentes avec le marché local</label></li><li><label><input type="checkbox"> Les charges et la rémunération sont réalistes</label></li><li><label><input type="checkbox"> Le plan de financement est équilibré</label></li><li><label><input type="checkbox"> Les paramètres fiscaux et sociaux sont validés avec l\'expert-comptable</label></li></ul>'+
  '<div class="champ"><label for="com">Commentaire du conseiller</label><textarea id="com" placeholder="Ex. : prévoir un devis pour le local avant le comité de prêt d\'honneur."></textarea></div>'},
function(){return '<div class="exports"><div><h3><svg class="ico"><use href="#i-doc"/></svg>PDF</h3><p class="note">Dossier complet pour banque, comité ou financeur.</p></div><div><h3><svg class="ico"><use href="#i-doc"/></svg>Word <span class="pil warn">V2</span></h3><p class="note">Texte du business plan à retoucher.</p></div><div><h3><svg class="ico"><use href="#i-doc"/></svg>Excel (CSV)</h3><p class="note">36 mois de chiffres, pour l\'expert-comptable.</p></div></div><div class="btn-rangee"><button class="btn btn-gold" id="b-pdf">Imprimer ou enregistrer en PDF</button><button class="btn btn-line" id="b-csv">Télécharger pour Excel (CSV)</button><button class="btn btn-line" id="b-json">Sauvegarder mes hypothèses</button></div><p class="note" style="margin-top:10px">Le PDF passe par la fenêtre d\'impression de votre navigateur : choisissez « Enregistrer au format PDF ». Le Word arrive dans la version 2.</p>'},
function(){var c=calc(H),nm=REEL.length;
  var th='<tr><th>Mois</th>'+c.rows.slice(0,nm).map(function(r){return '<th>M'+r.m+'</th>'}).join('')+'</tr>';
  var plan='<tr><td>CA prévu</td>'+c.rows.slice(0,nm).map(function(r){return '<td>'+fr.format(Math.round(r.ca)).replace(/ /g,' ')+'</td>'}).join('')+'</tr>';
  var reel='<tr><td>CA réel (à saisir)</td>'+REEL.map(function(v,i){return '<td><input class="rl" data-i="'+i+'" type="number" value="'+v+'" aria-label="CA réel mois '+(i+1)+'" style="width:84px;min-height:34px;border:1.5px solid var(--filet);border-radius:6px;text-align:right;padding:2px 6px;font:500 .9rem var(--texte)"></td>'}).join('')+'</tr>';
  var ec='<tr class="tot"><td>Écart</td>'+REEL.map(function(v,i){return '<td id="ec'+i+'"></td>'}).join('')+'</tr>';
  return '<p class="lead">Chaque mois, saisissez le chiffre d\'affaires réel. L\'outil mesure l\'écart avec le plan et propose de réviser les hypothèses.</p><div class="tw" tabindex="0"><table><thead>'+th+'</thead><tbody>'+plan+reel+ec+'</tbody></table></div><div id="ec-msg" class="alertes"></div><p class="note">Valeurs d\'exemple, à remplacer par vos relevés mensuels.</p>'}
];
var LEADS=["Dites en quelques mots ce que vous voulez lancer. Tout le reste du parcours en découle.","Combien un client paie-t-il en moyenne ?","Combien de clients, et à quel rythme ?","Ce que coûte le fonctionnement chaque mois.","Ce qu'il faut acheter pour démarrer, et comment vous le financez.","Les règles de TVA et de cotisations qui s'appliquent à votre statut.","Le moteur calcule 36 mois à partir de vos hypothèses.","Que se passe-t-il si les ventes démarrent moins bien, ou mieux ?","Le texte du dossier, écrit à partir des chiffres.","Les contrôles automatiques, puis la relecture humaine.","Le dossier prêt à envoyer.","Comparez vos chiffres réels au plan, mois après mois."];
var TITRES=["Votre idée en quelques lignes","Votre offre et vos prix","Vos ventes dans le temps","Ce que coûte votre activité","Investir et financer","Le cadre français","Votre prévisionnel","Et si les choses tournent autrement ?","Le business plan, rédigé","Contrôler avant d'envoyer","Exporter le dossier","Piloter votre projet"];

/* alertes : textes affichés pour chaque code du moteur */
function texteAlerte(a){var m={
 'tre-neg':['Trésorerie négative','Le point bas atteint '+eur(a.val)+' au mois '+a.mois+'. Prévoyez un apport, un prêt ou un report de charges.'],
 'tre-fragile':['Trésorerie fragile','Le point bas est de '+eur(a.val)+' au mois '+a.mois+'. Une baisse des ventes la rendrait négative.'],
 'tre-ok':['Trésorerie positive','Point bas : '+eur(a.val)+' au mois '+a.mois+'.'],
 'eq-jamais':['Pas d\'équilibre sur 3 ans','Le résultat reste négatif. Revoyez le prix, les charges ou le volume.'],
 'eq-tardif':['Équilibre tardif','Le résultat devient positif au mois '+a.mois+'.'],
 'eq-ok':['Équilibre atteint au mois '+a.mois,'Le résultat mensuel devient positif dans la première année.'],
 'apport-faible':['Apport faible','Les banques demandent souvent un apport d\'au moins 20 % de l\'investissement.'],
 'sans-salaire':['Aucune rémunération prévue','Prévoir au moins un revenu minimal rend le plan crédible pour un financeur.'],
 'seuil-inatteignable':['Seuil de rentabilité inatteignable','Les achats et les cotisations absorbent toute la marge. Revoyez le prix ou les coûts.']};
 return m[a.code]||[a.code,'']}
function majEcarts(){
  var c=calc(H),bad=0;
  REEL.forEach(function(v,i){var p=c.rows[i].ca,e=p?(v-p)/p*100:0,el=document.getElementById('ec'+i);if(!el)return;
    el.textContent=(e>=0?'+':'')+Math.round(e)+' %';el.className=e<-10?'neg':'';if(e<-10)bad++});
  var m=document.getElementById('ec-msg');if(!m)return;
  m.innerHTML=bad?'<div class="alerte warn"><svg class="ico"><use href="#i-alerte"/></svg><div><b>'+bad+' mois sous le plan de plus de 10 %</b>Révisez la croissance ou le prix, puis relancez les scénarios.</div></div>':'<div class="alerte ok"><svg class="ico"><use href="#i-coche"/></svg><div><b>Réel conforme au plan</b>Aucun écart supérieur à 10 % sur la période saisie.</div></div>';
}
function rendu(){
  var e=document.getElementById('etape');
  e.innerHTML='<p class="num">Étape '+(etape+1)+' sur 12 · '+PAS[etape].n+'</p><h2>'+TITRES[etape]+'</h2>'+(etape===11?'':'<p class="lead">'+LEADS[etape]+'</p>')+VUES[etape]()+nav();
  if(etape===11)majEcarts();
  var ol=document.getElementById('pas'),h='';
  PAS.forEach(function(p,i){if(p.g)h+='<li class="groupe">'+p.g+'</li>';
    h+='<li><button class="pas'+(fait[i]?' fait':'')+'" data-go="'+i+'"'+(i===etape?' aria-current="step"':'')+'><b>'+(fait[i]&&i!==etape?'✓':i+1)+'</b>'+p.n+'</button></li>'});
  ol.innerHTML=h;direct();
}
document.addEventListener('click',function(ev){var b=ev.target.closest('[data-go]');if(!b||b.disabled)return;
  fait[etape]=true;etape=+b.getAttribute('data-go');rendu();document.getElementById('etape').scrollIntoView({block:'start',behavior:'smooth'})});
document.addEventListener('input',function(ev){var t=ev.target;
  if(t.dataset.h){H[t.dataset.h]=parseFloat(t.value)||0;direct();sauver()}
  else if(t.dataset.t){H[t.dataset.t]=t.value;direct();sauver()}
  else if(t.classList.contains('rl')){REEL[+t.dataset.i]=parseFloat(t.value)||0;majEcarts();sauver()}
});

/* ── Enregistrement local (navigateur) ── */
var CLE='fabrique-simulateur-v1';
function sauver(){try{localStorage.setItem(CLE,JSON.stringify({H:H,REEL:REEL,fait:fait}))}catch(e){}}
function charger(){try{var d=JSON.parse(localStorage.getItem(CLE)||'null');if(d&&d.H){Object.keys(d.H).forEach(function(k){H[k]=d.H[k]});if(d.REEL)REEL=d.REEL;if(d.fait)fait=d.fait}}catch(e){}}

/* ── Exports ── */
function telecharger(nom,type,texte){var b=new Blob([texte],{type:type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=nom;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
function slug(){return (H.nom||'projet').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'projet'}
function csv(){var c=calc(H),n=function(v){return String(Math.round(v*100)/100).replace('.',',')};
  var l=[['Mois','Clients','Chiffre d\'affaires','Achats','Charges fixes','Cotisations','Dotation amortissements','Intérêts','Résultat','Flux de trésorerie','Trésorerie cumulée'].join(';')];
  c.rows.forEach(function(r){l.push([r.m,n(r.cl),n(r.ca),n(r.ach),n(r.fix),n(r.cot),n(r.dot),n(r.inter),n(r.res),n(r.flux),n(r.tre)].join(';'))});
  l.push('');l.push('Hypothèses;'+Object.keys(H).filter(function(k){return k!=='desc'}).map(function(k){return k+'='+H[k]}).join(' | '));
  return '\ufeff'+l.join('\r\n')}
document.addEventListener('click',function(ev){var id=ev.target.id;
  if(id==='b-pdf'){dossier();window.print()}
  else if(id==='b-csv')telecharger('previsionnel-'+slug()+'.csv','text/csv;charset=utf-8',csv());
  else if(id==='b-json')telecharger('hypotheses-'+slug()+'.json','application/json',JSON.stringify({version:1,hypotheses:H,reel:REEL},null,2));
  else if(id==='b-reset'){if(ev.target.dataset.sure){try{localStorage.removeItem(CLE)}catch(e){}H=Engine.clone(Engine.DEFAUT);REEL=[1500,1700,1900,2100,2300,2500];fait={};etape=0;rendu()}else{ev.target.dataset.sure='1';ev.target.textContent='Cliquez encore pour tout effacer'}}
});
/* Version imprimable : récit, prévisionnel et scénarios à la suite */
function dossier(){var d=document.getElementById('dossier');
  d.innerHTML='<h1>'+esc(H.nom)+'</h1><p class="note">Business plan prévisionnel · généré avec le simulateur de La Fabrique du Génie · '+new Date().toLocaleDateString('fr-FR')+'</p><h2>Présentation</h2>'+VUES[8]()+'<h2>Prévisionnel</h2>'+VUES[6]()+'<h2>Scénarios et sensibilité</h2>'+VUES[7]()+'<h2>Contrôles</h2>'+VUES[9]().split('<h3>Relecture')[0]+'<p class="note">Document de travail. Les taux fiscaux et sociaux sont des paramètres à valider avec un expert-comptable.</p>'}
window.addEventListener('beforeprint',dossier);

charger();rendu();
