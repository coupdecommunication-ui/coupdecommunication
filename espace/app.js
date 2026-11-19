/* Espace client Coup de Com' : appli (Supabase).
   Vue client (vous ou tu selon le client, rôles gérant / équipe / compta) et vue gestion pour l'agence. */
(() => {
'use strict';
const C = window.ESPACE_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3400); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const eur = n => new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(+n || 0);
const num = n => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:0}).format(+n || 0);
const pct = n => new Intl.NumberFormat('fr-FR', {maximumFractionDigits:1, minimumFractionDigits:1}).format(+n || 0) + ' %';
const fd = s => { if (!s) return ''; const d = new Date(String(s).slice(0, 10) + 'T12:00'); return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', {day:'numeric', month:'long'}); };
const fdt = t => t ? new Date(t).toLocaleString('fr-FR', {dateStyle:'short', timeStyle:'short'}) : '';
const fwhen = t => { if (!t) return 'date à fixer'; const d = new Date(t); return d.toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short'}) + ' · ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}); };
const fmonth = m => { if (!m) return ''; const d = new Date(m + '-15T12:00'); return isNaN(d) ? m : d.toLocaleDateString('fr-FR', {month:'long', year:'numeric'}); };
const fmon = m => { const d = new Date(m + '-15T12:00'); return isNaN(d) ? m : d.toLocaleDateString('fr-FR', {month:'short'}).replace('.', ''); };
const today = () => new Date().toISOString().slice(0, 10);
const okUrl = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';
const safeName = s => String(s || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-60);
const slug = s => String(s || 'projet').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projet';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isImg = m => /^image\//.test(m.type || '') || /\.(jpe?g|png|webp|gif|svg)$/i.test(m.name || m.file || '');
const isVid = m => /^video\//.test(m.type || '') || /\.(mp4|mov|webm|m4v)$/i.test(m.name || m.file || '');

const ADMINS = [].concat(C.adminEmails || C.adminEmail || []).map(s => String(s).toLowerCase());
const SIGN = 'Coup de Com’';
const AGENCY_MAIL = C.agencyEmail || ADMINS[0] || '';
const NETS = {instagram:['Instagram','IG'], facebook:['Facebook','FB'], tiktok:['TikTok','TT'], linkedin:['LinkedIn','IN'], google:['Fiche Google','G'], youtube:['YouTube','YT'], pinterest:['Pinterest','PIN'], x:['X','X']};
const FORMATS = {post:'Post', carrousel:'Carrousel', reel:'Reel', story:'Story', video:'Vidéo', actu:'Actu Google'};
const ROLES = {gerant:['Gérant', 'voit tout, valide les posts, accepte les devis'], equipe:['Équipe', 'posts, calendrier, rapports, brief, sans les factures'], compta:['Compta', 'devis et factures uniquement']};
const METRICS = [['followers','Abonnés','last'], ['reach','Portée','sum'], ['impressions','Vues','sum'], ['interactions','Interactions','sum'], ['posts','Publications','sum'], ['visits','Visites du profil','sum'], ['clicks','Clics','sum']];
const MAX_FILE = 50 * 1024 * 1024;
const PUBLIC_URL = C.publicUrl || (location.origin + location.pathname.replace(/[^/]*$/, ''));
const blank = () => ({stage:'client', client:'', project:'', intro:'', next:'', nextDate:'', contact:'', tone:'vous', reviewHours:48, rounds:2, nets:['instagram', 'facebook'], tasks:[], reports:[], livrables:[], dlvBtn:''});
const app = () => $('#app');

let sb = null, session = null, email = '', isAdmin = false;
let P = null, D = null, ROLE = null, MEMBERS = [], POSTS = [], REV = {}, BILL = [], BRIEF = null, DLV = null, AGENCY = null, OPEN = false, URLS = {};
let mode = 'edit', viewRole = 'gerant', MULTI = false;

/* Ton : vouvoiement ou tutoiement, choisi par client */
const tu = () => !!D && D.tone === 'tu';
const T = (vous, toi) => tu() ? toi : vous;
const role = () => isAdmin ? viewRole : ROLE;
const can = {
  posts: () => ['gerant', 'equipe'].includes(role()),
  bill: () => ['gerant', 'compta'].includes(role()),
  accept: () => role() === 'gerant'
};

/* ---------- démarrage ---------- */
function prep(msg) { app().innerHTML = `<div class="eyebrow">Coup de Com’</div><h1>Votre espace arrive.</h1><p class="lead">${msg}</p>`; }
if (!C.url || !C.anonKey || !window.supabase) {
  prep(!window.supabase && C.url ? 'La page n’a pas pu se charger complètement. Vérifiez votre connexion puis rechargez la page.' : 'L’espace client Coup de Com’ est en cours de préparation. Revenez un peu plus tard.');
  return;
}
sb = window.supabase.createClient(C.url, C.anonKey, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});

function setUser(s) {
  session = s; email = s && s.user && s.user.email ? s.user.email.toLowerCase() : '';
  isAdmin = !!email && ADMINS.includes(email);
  $('#me').hidden = !email; $('#meMail').textContent = email;
  document.body.classList.toggle('is-admin', isAdmin);
}
$('#logout').onclick = async () => { await flushAll(); await sb.auth.signOut(); P = D = null; location.hash = ''; setUser(null); renderLogin(); };

(async () => {
  const err = new URLSearchParams(location.hash.slice(1)).get('error_description');
  const {data} = await sb.auth.getSession();
  setUser(data.session);
  sb.auth.onAuthStateChange((ev, s) => {
    const was = email; setUser(s);
    if (ev === 'SIGNED_IN' && !was) { $('#toast').classList.remove('on'); route(); }
    if (ev === 'SIGNED_OUT') { P = D = null; renderLogin(); }
  });
  if (!session) { renderLogin(err ? 'Ce lien de connexion n’est plus valable (il sert une seule fois et expire au bout d’une heure). Demandez-en un nouveau ci-dessous.' : ''); return; }
  route();
})();
addEventListener('hashchange', () => { if (session && !/access_token|error/.test(location.hash)) route(); });
const hashId = () => { const m = location.hash.match(/^#p=([0-9a-f-]{36})$/); return m ? m[1] : null; };

/* ---------- enregistrement automatique (une file d'attente par élément) ---------- */
const Q = {};
const saveSt = t => { const s = $('#saveSt'); if (s) s.textContent = t; };
function later(key, fn, ms = 700) {
  saveSt('Modifications en cours…');
  if (Q[key]) clearTimeout(Q[key].t);
  Q[key] = {fn, t:setTimeout(() => run(key), ms)};
}
async function run(key) {
  const q = Q[key]; if (!q) return; delete Q[key];
  const ok = await q.fn();
  if (!Object.keys(Q).length) saveSt(ok === false ? 'Enregistrement impossible : vérifie ta connexion' : 'Enregistré');
}
async function flushAll() { for (const k of Object.keys(Q)) { clearTimeout(Q[k].t); await run(k); } }
addEventListener('beforeunload', e => { if (Object.keys(Q).length) { flushAll(); e.preventDefault(); e.returnValue = ''; } });

/* ---------- connexion ---------- */
function renderLogin(info) {
  $('#hdr').textContent = 'Espace client';
  app().innerHTML = `<div class="login">
    <div class="eyebrow">Coup de Com’</div><h1>Votre espace client</h1>
    <p class="lead">Posts à valider, calendrier, rapports et factures, au même endroit. Pas de mot de passe à retenir : indiquez votre adresse e-mail, vous recevez un lien de connexion.</p>
    ${info ? `<div class="hint" style="margin-bottom:16px">${esc(info)}</div>` : ''}
    <form class="card" id="fLogin" novalidate>
      <label class="f">Votre adresse e-mail<input class="in" id="lEmail" type="email" autocomplete="username" inputmode="email" required placeholder="vous@etablissement.fr"></label>
      <label class="f" id="lPwBox" hidden style="margin-top:10px">Mot de passe<input class="in" id="lPw" type="password" autocomplete="current-password"></label>
      <div class="acts"><button class="btn primary" id="lSend" type="submit">Recevoir mon lien de connexion</button><button class="btn sm ghost" id="lPwToggle" type="button">J’ai un mot de passe</button></div>
    </form>
    <div class="card" id="fCode" hidden>
      <p style="margin-top:0"><b>C’est envoyé.</b> Ouvrez l’e-mail reçu à l’adresse <b id="cMail"></b> et cliquez sur le lien. Pensez à regarder dans les indésirables.</p>
      <p class="note">L’e-mail contient aussi un code à 6 chiffres : vous pouvez le saisir ici (pratique si vous lisez vos e-mails sur un autre appareil).</p>
      <form id="fOtp" class="otp" novalidate><input class="in" id="cCode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" aria-label="Code reçu par e-mail"><button class="btn primary" type="submit">Valider le code</button></form>
      <div class="acts"><button class="btn sm ghost" id="cBack" type="button">Changer d’adresse</button><button class="btn sm ghost" id="cAgain" type="button">Renvoyer l’e-mail</button></div>
    </div></div>`;
  let lastMail = '', pwMode = false;
  const sendLink = async (mail, btn) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { toast('Vérifiez l’adresse e-mail'); return; }
    btn.disabled = true; const t = btn.textContent; btn.textContent = 'Envoi…';
    const {error} = await sb.auth.signInWithOtp({email:mail, options:{emailRedirectTo:PUBLIC_URL, shouldCreateUser:true}});
    btn.disabled = false; btn.textContent = t;
    if (error) {
      const m = error.message || '';
      toast(/seconds|security purposes/i.test(m) ? 'Un lien vient d’être envoyé : patientez une minute avant d’en redemander un'
        : /rate|limit|too many/i.test(m) ? 'Beaucoup de demandes en ce moment : réessayez dans quelques minutes (ou connectez-vous avec votre mot de passe si vous en avez un)'
        : 'L’envoi n’a pas fonctionné, réessayez dans un instant');
      return;
    }
    lastMail = mail; $('#cMail').textContent = mail; $('#fLogin').hidden = true; $('#fCode').hidden = false;
  };
  $('#lPwToggle').onclick = () => {
    pwMode = !pwMode; $('#lPwBox').hidden = !pwMode;
    $('#lSend').textContent = pwMode ? 'Se connecter' : 'Recevoir mon lien de connexion';
    $('#lPwToggle').textContent = pwMode ? 'Recevoir un lien à la place' : 'J’ai un mot de passe';
    (pwMode ? $('#lPw') : $('#lEmail')).focus();
  };
  $('#fLogin').onsubmit = async e => {
    e.preventDefault(); const mail = $('#lEmail').value.trim().toLowerCase();
    if (!pwMode) { sendLink(mail, $('#lSend')); return; }
    const pw = $('#lPw').value; if (!mail || !pw) { toast('Indiquez votre adresse et votre mot de passe'); return; }
    const b = $('#lSend'); b.disabled = true;
    const {error} = await sb.auth.signInWithPassword({email:mail, password:pw});
    b.disabled = false;
    if (error) toast(/rate|limit/i.test(error.message) ? 'Trop d’essais : patientez une minute' : 'Adresse ou mot de passe incorrect. Pas de mot de passe ? Recevez un lien.');
  };
  $('#fOtp').onsubmit = async e => {
    e.preventDefault(); const token = $('#cCode').value.replace(/\D/g, '');
    if (token.length < 6) { toast('Le code fait 6 chiffres'); return; }
    const {error} = await sb.auth.verifyOtp({email:lastMail, token, type:'email'});
    if (error) toast('Code incorrect ou expiré');
  };
  $('#cBack').onclick = () => { $('#fCode').hidden = true; $('#fLogin').hidden = false; };
  $('#cAgain').onclick = e => sendLink(lastMail, e.target);
  setTimeout(() => $('#lEmail') && $('#lEmail').focus(), 50);
}

/* ---------- navigation ---------- */
async function route() {
  if (!session) { renderLogin(); return; }
  if (/access_token/.test(location.hash)) history.replaceState(null, '', location.pathname);
  await flushAll();
  if (typeof recStop === 'function') recStop(true);
  closeSheet(true); DRAFT = {}; REEDIT = {}; openPost = null; CAL = null;
  const id = hashId();
  if (isAdmin) { if (id) await openProject(id); else await adminList(); }
  else await clientHome(id);
}

/* ---------- chargement d'un projet ---------- */
async function signFiles(paths) {
  paths = [...new Set(paths.filter(p => p && !URLS[p]))];
  for (let i = 0; i < paths.length; i += 100) {
    const {data} = await sb.storage.from('espace').createSignedUrls(paths.slice(i, i + 100), 4 * 3600);
    (data || []).forEach(x => { if (x && x.signedUrl && !x.error) URLS[x.path] = x.signedUrl; });
  }
}
const fileUrl = p => p ? URLS[p] || '' : '';
function projectFiles() {
  const l = [];
  POSTS.forEach(p => (p.media || []).forEach(m => l.push(m.file)));
  BILL.forEach(b => l.push(b.file));
  D.livrables.forEach(x => { l.push(x.preview); if (OPEN || isAdmin) l.push(x.src); });
  D.reports.forEach(r => (r.top || []).forEach(t => l.push(t.img)));
  if (BRIEF && BRIEF.data) [...(BRIEF.data.files || []), ...(BRIEF.data.voice || [])].forEach(f => l.push(f.path));
  return l;
}
function mapReviews(rows) {
  REV = {};
  (rows || []).forEach(r => (REV[r.post_id] = REV[r.post_id] || []).push(r));
  Object.values(REV).forEach(a => a.sort((x, y) => Date.parse(x.created_at) - Date.parse(y.created_at)));
}
async function loadProject(id) {
  const {data, error} = await sb.from('projects').select('*').eq('id', id).maybeSingle();
  if (error || !data) return false;
  P = data; D = {...blank(), ...(data.data || {})};
  ['tasks', 'reports', 'livrables', 'nets'].forEach(k => { if (!Array.isArray(D[k])) D[k] = blank()[k]; });
  const mem = await sb.from('members').select('*').eq('project_id', id).order('created_at', {ascending:true});
  MEMBERS = mem.data || [];
  ROLE = isAdmin ? 'admin' : ((MEMBERS.find(m => m.email === email) || {}).role || null);
  const seeBill = isAdmin || ['gerant', 'compta'].includes(ROLE), seePosts = isAdmin || ['gerant', 'equipe'].includes(ROLE);
  const none = Promise.resolve({data:null});
  const [po, rv, bi, br, dl, ag, op] = await Promise.all([
    seePosts ? sb.from('posts').select('*').eq('project_id', id).order('publish_at', {ascending:true}) : none,
    seePosts ? sb.from('post_reviews').select('*').eq('project_id', id).order('created_at', {ascending:true}) : none,
    seeBill ? sb.from('billing').select('*').eq('project_id', id).order('created_at', {ascending:true}) : none,
    seePosts ? sb.from('briefs').select('*').eq('project_id', id).maybeSingle() : none,
    seePosts ? sb.from('deliveries').select('*').eq('project_id', id).maybeSingle() : none,
    seeBill ? sb.from('agency').select('*').eq('id', 1).maybeSingle() : none,
    seePosts ? sb.rpc('livrables_ouverts', {p:id}) : none]);
  POSTS = po.data || []; mapReviews(rv.data); BILL = bi.data || []; BRIEF = br.data || null; DLV = dl.data || null; AGENCY = ag.data || null; OPEN = !!op.data;
  await signFiles(projectFiles());
  return true;
}

/* ---------- état d'un post ---------- */
const lastRev = p => { const a = (REV[p.id] || []).filter(r => r.v === p.v); return a[a.length - 1] || null; };
const deadline = p => p.sent_at ? Date.parse(p.sent_at) + (p.review_hours || 48) * 3600e3 : 0;
function pstat(p) {
  if (p.state === 'draft') return {k:'draft', l:'Brouillon', c:''};
  if (p.state === 'published') return {k:'pub', l:'Publié', c:'done'};
  const r = lastRev(p);
  if (r && r.decision === 'ok') return {k:'ok', l:'Validé', c:'ok', r};
  if (r && r.decision === 'change') return {k:'change', l:'Modification demandée', c:'red', r};
  if (Date.now() > deadline(p)) return {k:'auto', l:'Validé automatiquement', c:'ok'};
  return {k:'wait', l:'À valider', c:'wait'};
}
const isOpen = p => p.state === 'review' && Date.now() <= deadline(p);
const fleft = p => { const ms = deadline(p) - Date.now(); if (ms <= 0) return ''; const h = Math.floor(ms / 3600e3); return h >= 48 ? `${Math.floor(h / 24)} jours` : h >= 1 ? `${h} h` : `${Math.max(1, Math.round(ms / 60e3))} min`; };
const netTags = nets => (nets || []).filter(n => NETS[n]).map(n => `<span class="net" title="${esc(NETS[n][0])}">${esc(NETS[n][1])}</span>`).join('');
const roundsLeft = p => Math.max(0, (+D.rounds || 0) - ((p.v || 1) - 1));

/* ---------- e-mail à l'agence (Web3Forms) ---------- */
function mail(subject, lines) {
  if (!C.notifyKey || isAdmin) return;
  lines = lines.concat(['', 'De : ' + email + (ROLE ? ` (${ROLES[ROLE] ? ROLES[ROLE][0] : ROLE})` : ''), 'Ouvrir le projet : ' + PUBLIC_URL + '#p=' + P.id]);
  fetch('https://api.web3forms.com/submit', {method:'POST', headers:{'Content-Type':'application/json', Accept:'application/json'},
    body:JSON.stringify({access_key:C.notifyKey, subject:`Espace client · ${D.client || 'Client'} : ${subject}`, from_name:'Espace client Coup de Com’', replyto:email, message:lines.join('\n')})}).catch(() => {});
}
function confirmBtn(b, fn, label) { if (b.dataset.sure) { delete b.dataset.sure; fn(); return; } b.dataset.sure = 1; const t = b.textContent; b.textContent = label || 'Confirmer ?'; setTimeout(() => { if (b.isConnected && b.dataset.sure) { delete b.dataset.sure; b.textContent = t; } }, 4000); }
const copy = async (txt, ok) => { try { await navigator.clipboard.writeText(txt); toast(ok); } catch { prompt('Copiez ce texte :', txt); } };
async function upload(path, blob, type) {
  const {error} = await sb.storage.from('espace').upload(path, blob, {cacheControl:'3600', upsert:false, contentType:type || blob.type || undefined});
  if (error) throw error;
  return path;
}
function pick(accept, multiple) {
  return new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.multiple = !!multiple; i.onchange = () => ok([...i.files]); i.click(); });
}

/* =====================================================================
   VUE CLIENT
   ===================================================================== */
let openPost = null, DRAFT = {}, REEDIT = {}, CAL = null, REP = {m:null, n:'all'}, sheetLast = null;

async function clientHome(id) {
  app().innerHTML = '<p class="note">Chargement de votre espace…</p>';
  const {data, error} = await sb.from('projects').select('id,data,updated_at').order('updated_at', {ascending:false});
  if (error) { app().innerHTML = '<p class="note">Votre espace ne répond pas pour le moment. Rechargez la page dans un instant.</p>'; return; }
  if (!data.length) {
    D = null; $('#hdr').textContent = 'Espace client';
    app().innerHTML = `<div class="eyebrow">Coup de Com’</div><h1>Aucun projet pour l’instant.</h1><p class="lead">Aucun projet n’est encore associé à l’adresse <b>${esc(email)}</b>. Si vous avez reçu une invitation de Coup de Com’, vérifiez que vous êtes connecté avec la même adresse.</p><div class="acts"><button class="btn" id="out2">Me connecter avec une autre adresse</button></div>`;
    $('#out2').onclick = () => $('#logout').click(); return;
  }
  const target = id && data.find(p => p.id === id) ? id : data.length === 1 ? data[0].id : null;
  if (!target) {
    D = null; $('#hdr').textContent = 'Espace client';
    app().innerHTML = `<div class="eyebrow">Coup de Com’</div><h1>Vos projets</h1><div class="plist">${data.map(p => `<a class="card pcard" href="#p=${p.id}"><b>${esc(p.data.project || 'Projet')}</b><small>${esc(p.data.client || '')}</small></a>`).join('')}</div>`;
    return;
  }
  if (!await loadProject(target)) { app().innerHTML = '<p class="note">Ce projet n’est pas disponible.</p>'; return; }
  mode = 'view'; MULTI = data.length > 1; renderClient();
}

function hdr(list) { $('#hdr').textContent = !list && D && D.client ? `Espace client · ${D.client}` : 'Espace client'; }
const thumbOf = p => { const m = (p.media || []).find(x => isImg(x) && fileUrl(x.file)); return m ? `<img src="${esc(fileUrl(m.file))}" alt="" loading="lazy">` : `<span class="ph">${esc((FORMATS[p.format] || 'Post').slice(0, 1))}</span>`; };

function renderClient() {
  hdr();
  const a = app(), preview = isAdmin, r = role();
  let h = '';
  if (preview) h += `<div class="hint prev"><p style="margin:0 0 8px"><b>Aperçu de ce que voit ton client.</b> Les réponses sont désactivées dans l’aperçu.</p><div class="acts" style="margin:0"><span class="seg">${['gerant', 'equipe', 'compta'].map(x => `<button data-vr="${x}" aria-pressed="${x === r}">${ROLES[x][0]}</button>`).join('')}</span><button class="btn sm" id="backEdit">Revenir à la gestion</button></div></div>`;
  if (MULTI && !preview) h += `<p><a href="#" class="note">← Tous mes projets</a></p>`;
  h += `<div class="eyebrow">${esc(D.client || 'Coup de Com’')}</div><h1>${esc(D.project || T('Votre espace', 'Ton espace'))}</h1>`;
  h += `<p class="lead">${esc(D.intro || (prospect() ? T('Merci pour notre échange ! Cet espace nous permet de préparer ensemble votre projet.', 'Merci pour notre échange ! Cet espace nous permet de préparer ensemble ton projet.') : T('Voici où en est votre communication.', 'Voici où en est ta communication.')))}</p>`;
  if (D.next && r !== 'compta') h += `<div class="next"><b>Prochaine étape</b><span>${esc(D.next)}${D.nextDate ? ` · ${fd(D.nextDate)}` : ''}</span></div>`;
  if (prospect()) {
    if (r !== 'compta') h += briefClient();
    if (can.bill()) h += billingClient(true);
  } else if (r === 'compta') {
    h += billingClient();
  } else {
    h += deliverCard();
    h += waitSection();
    if (D.brief !== false && !(BRIEF && BRIEF.submitted)) h += briefClient();
    h += calendarClient() + reportsClient() + livrablesClient() + tasksClient();
    if (r === 'gerant') h += billingClient();
    if (BRIEF && BRIEF.submitted) h += briefClient();
  }
  h += `<p class="note" style="margin-top:44px">${D.contact ? `Une question ? ${esc(D.contact)}` : `Une question ? Écrivez à ${esc(AGENCY_MAIL)}`}</p>`;
  a.innerHTML = h;
  a.onclick = clientClick; a.oninput = clientInput; a.onchange = clientChange;
  bindTips(a);
}

/* ---------- À valider ---------- */
function waitSection() {
  const vis = POSTS.filter(p => p.state !== 'draft');
  if (!vis.length) return '';
  const wait = vis.filter(p => pstat(p).k === 'wait').sort((x, y) => deadline(x) - deadline(y));
  const chg = vis.filter(p => pstat(p).k === 'change');
  let h = `<h2>À valider ${wait.length ? `<small>${wait.length} post${wait.length > 1 ? 's' : ''}</small>` : ''}</h2>`;
  if (!wait.length) h += `<p class="empty">Rien à valider pour le moment. ${T('Merci !', 'Merci !')}</p>`;
  else {
    h += `<div class="plist">${wait.map(p => `<button class="card pc" data-open="${esc(p.id)}"><span class="pth">${thumbOf(p)}</span><span class="pcb"><b>${esc(p.title || FORMATS[p.format] || 'Post')}</b><small><span class="nets">${netTags(p.networks)}</span>${esc(FORMATS[p.format] || '')} · publication ${esc(fwhen(p.publish_at))}</small><small class="dl">Réponse attendue avant ${esc(fwhen(deadline(p)))} · encore ${esc(fleft(p))}</small></span><span class="go" aria-hidden="true">›</span></button>`).join('')}</div>`;
    h += `<p class="note">${T('Sans réponse dans le délai, le post est validé automatiquement : votre compte reste actif.', 'Sans réponse dans le délai, le post est validé automatiquement : ton compte reste actif.')}</p>`;
  }
  if (chg.length) h += `<p class="note">${chg.length} post${chg.length > 1 ? 's' : ''} en cours de modification par Coup de Com’ : ${T('vous recevrez', 'tu recevras')} la nouvelle version ici.</p>`;
  return h;
}

/* ---------- fiche d'un post (plein écran sur téléphone) ---------- */
function openSheet(id) { openPost = id; sheetLast = document.activeElement; renderSheet(); }
function closeSheet(silent) {
  const s = $('#sheet'); if (!s) return;
  s.remove(); document.body.style.overflow = ''; openPost = null;
  if (!silent && sheetLast && sheetLast.isConnected) sheetLast.focus();
}
function pinsHtml(pins, mi) {
  return (pins || []).map((x, i) => x.m === mi ? `<span class="pin" style="left:${+x.x}%;top:${+x.y}%">${i + 1}</span>` : '').join('');
}
function revSummary(r, withDate) {
  if (!r) return '';
  const l = [];
  (r.pins || []).forEach((x, i) => l.push(`<li><span class="pin st">${i + 1}</span> ${esc(x.t || 'Repère sur l’image')}</li>`));
  if (r.caption_note) l.push(`<li><b>Légende :</b> ${esc(r.caption_note)}</li>`);
  if (r.note) l.push(`<li><b>Remarque :</b> ${esc(r.note)}</li>`);
  return `<div class="fbbox"><b>${r.decision === 'ok' ? 'Validé' : 'Modification demandée'}</b>${withDate ? ` · ${fdt(r.created_at)}${r.author_email ? ' · ' + esc(r.author_email) : ''}` : ''}${l.length ? `<ul class="rl">${l.join('')}</ul>` : ''}</div>`;
}
function renderSheet() {
  const p = POSTS.find(x => x.id === openPost); if (!p) { closeSheet(true); return; }
  let el = $('#sheet');
  if (!el) {
    el = document.createElement('div'); el.id = 'sheet'; el.className = 'sheet';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Détail du post');
    document.body.appendChild(el); document.body.style.overflow = 'hidden'; bindSheet(el);
  }
  const st = pstat(p), dr = DRAFT[p.id], last = lastRev(p), open = isOpen(p) && can.posts();
  const showPins = dr ? dr.pins : (last ? last.pins : []);
  const media = p.media || [];
  let h = `<div class="sh-in"><div class="sh-top"><span class="pill ${st.c}">${st.l}</span><b>${esc(p.title || FORMATS[p.format] || 'Post')}</b><button class="btn sm ghost" data-x>Fermer</button></div><div class="sh-body">`;
  if (media.length) {
    h += `<div class="med${dr ? ' pinning' : ''}">${media.map((m, i) => `<figure class="mi" data-mi="${i}">${isVid(m) ? `<video controls playsinline preload="metadata" src="${esc(fileUrl(m.file))}"></video>` : `<span class="pw"><img src="${esc(fileUrl(m.file))}" alt="Visuel ${i + 1}${media.length > 1 ? ' sur ' + media.length : ''}" draggable="false">${pinsHtml(showPins, i)}</span>`}</figure>`).join('')}</div>`;
    if (media.length > 1) h += `<p class="note center">${media.length} visuels · faites défiler sur le côté</p>`;
  }
  if (okUrl(p.link)) h += `<div class="acts"><a class="btn" href="${esc(okUrl(p.link))}" target="_blank" rel="noopener">Voir le visuel ↗</a></div>`;
  h += `<p class="meta"><span class="nets">${netTags(p.networks)}</span>${esc(FORMATS[p.format] || '')} · publication prévue ${esc(fwhen(p.publish_at))}${p.v > 1 ? ` · version ${p.v}` : ''}</p>`;
  h += `<div class="cap"><span class="lbl">Légende</span>${p.caption ? `<p>${esc(p.caption)}</p>` : '<p class="note">Pas de légende pour ce post.</p>'}</div>`;
  if (p.note) h += `<div class="msg"><i>Mot de Coup de Com’</i>${esc(p.note)}</div>`;
  h += '<div class="sh-act">';
  if (st.k === 'pub') h += `<p><b>Publié.</b> ${last ? (last.decision === 'ok' ? 'Validé le ' + fdt(last.created_at) + '.' : '') : ''}</p>`;
  else if (st.k === 'auto') h += `<p><b>Validé automatiquement</b> le ${fdt(deadline(p))}, sans réponse dans le délai de ${p.review_hours} h.</p>`;
  else if (open && !isAdmin) {
    if (last && !dr && !REEDIT[p.id]) {
      h += `<p><b>${last.decision === 'ok' ? T('Merci, c’est validé.', 'Merci, c’est validé.') : T('Merci, votre demande est transmise.', 'Merci, ta demande est transmise.')}</b></p>${revSummary(last)}`;
      h += `<p class="note">${T('Vous pouvez changer votre réponse', 'Tu peux changer ta réponse')} jusqu’au ${fdt(deadline(p))}.</p><div class="acts"><button class="btn sm" data-edit>${T('Changer ma réponse', 'Changer ma réponse')}</button></div>`;
    } else if (!dr) {
      h += `<p class="dl">Réponse attendue avant ${esc(fwhen(deadline(p)))} (encore ${esc(fleft(p))}). Sans réponse, le post sera validé automatiquement.</p>`;
      h += `<div class="dec"><button class="ok" data-ok>Je valide</button><button data-chg>Je demande une modification</button></div>`;
    } else {
      const hasImg = media.some(m => !isVid(m));
      h += `<div class="fb"><p><b>Qu’est-ce qu’on modifie ?</b></p>${hasImg ? `<p class="note">${T('Touchez l’image à l’endroit à modifier pour poser un repère, puis écrivez votre remarque.', 'Touche l’image à l’endroit à modifier pour poser un repère, puis écris ta remarque.')}</p>` : ''}`;
      if (dr.pins.length) h += `<ol class="pins">${dr.pins.map((x, i) => `<li><span class="pin st">${i + 1}</span><input class="in" data-pin="${i}" maxlength="140" value="${esc(x.t)}" placeholder="ex. Mettre le plat plus en avant" aria-label="Remarque pour le repère ${i + 1}"><button class="icon" data-unpin="${i}" aria-label="Retirer le repère ${i + 1}">×</button></li>`).join('')}</ol>`;
      h += `<label class="f">Dans la légende <span class="note">(facultatif)</span><textarea class="in" data-dr="caption_note" maxlength="600" placeholder="ex. Ajouter les horaires du brunch">${esc(dr.caption_note)}</textarea></label>`;
      h += `<label class="f">Autre remarque <span class="note">(facultatif)</span><textarea class="in" data-dr="note" maxlength="600" placeholder="ex. Publier plutôt le samedi">${esc(dr.note)}</textarea></label>`;
      if (+D.rounds && roundsLeft(p) === 0) h += `<p class="note">Les retouches incluses pour ce post sont utilisées : une nouvelle modification pourra faire l’objet d’un devis.</p>`;
      else if (+D.rounds) h += `<p class="note">Retouches incluses restantes pour ce post : <b>${roundsLeft(p)}</b> sur ${+D.rounds}.</p>`;
      h += `<div class="acts"><button class="btn primary" data-send>Envoyer ma demande</button><button class="btn ghost" data-cancel>Annuler</button></div></div>`;
    }
  } else if (open && isAdmin) {
    h += `<p class="dl">Réponse attendue avant ${esc(fwhen(deadline(p)))} (encore ${esc(fleft(p))}).</p><div class="dec"><button class="ok" data-ok>Je valide</button><button data-chg>Je demande une modification</button></div>`;
    if (last) h += revSummary(last, true);
  } else if (st.k === 'change') h += `<p><b>${T('Votre demande est transmise.', 'Ta demande est transmise.')}</b> Coup de Com’ prépare une nouvelle version.</p>${revSummary(last)}`;
  else if (st.k === 'ok') h += `<p><b>Validé</b> le ${fdt(last.created_at)}.</p>`;
  h += '</div>';
  const older = (REV[p.id] || []).filter(r => r.v !== p.v);
  if (older.length) h += `<details><summary>Versions précédentes (${older.length} réponse${older.length > 1 ? 's' : ''})</summary>${older.slice().reverse().map(r => `<p class="note" style="margin:8px 0 4px">Version ${r.v}</p>${revSummary(r, true)}`).join('')}</details>`;
  h += '</div></div>';
  el.innerHTML = h;
  if (!el.contains(document.activeElement)) { const f = el.querySelector('[data-x]'); if (f) f.focus(); }
}
function bindSheet(el) {
  el.onclick = async e => {
    if (e.target === el) { closeSheet(); return; }
    const p = POSTS.find(x => x.id === openPost); if (!p) return;
    const b = e.target.closest('button');
    const fig = e.target.closest('.med.pinning figure');
    if (!b && fig && e.target.tagName === 'IMG') {
      const dr = DRAFT[p.id]; if (!dr) return;
      if (dr.pins.length >= 8) { toast('8 repères maximum : gardez l’essentiel'); return; }
      const r = e.target.getBoundingClientRect();
      dr.pins.push({m:+fig.dataset.mi, x:Math.round((e.clientX - r.left) / r.width * 1000) / 10, y:Math.round((e.clientY - r.top) / r.height * 1000) / 10, t:''});
      const sc = el.querySelector('.sh-body').scrollTop, med = el.querySelector('.med').scrollLeft;
      renderSheet(); el.querySelector('.sh-body').scrollTop = sc; el.querySelector('.med').scrollLeft = med;
      const inp = el.querySelector(`[data-pin="${dr.pins.length - 1}"]`); if (inp) inp.focus({preventScroll:true});
      return;
    }
    if (!b) return;
    if (b.hasAttribute('data-x')) { closeSheet(); return; }
    if (isAdmin && (b.hasAttribute('data-ok') || b.hasAttribute('data-chg'))) { toast('Aperçu : seul ton client peut répondre'); return; }
    if (b.hasAttribute('data-ok')) { DRAFT[p.id] = {pins:[], caption_note:'', note:''}; await sendReview(p, 'ok', b); return; }
    if (b.hasAttribute('data-edit')) { REEDIT[p.id] = true; renderSheet(); return; }
    if (b.hasAttribute('data-chg')) { const r = lastRev(p); DRAFT[p.id] = r && r.decision === 'change' ? {pins:(r.pins || []).map(x => ({...x})), caption_note:r.caption_note || '', note:r.note || ''} : {pins:[], caption_note:'', note:''}; renderSheet(); return; }
    if (b.hasAttribute('data-cancel')) { delete DRAFT[p.id]; renderSheet(); return; }
    if (b.dataset.unpin != null) { DRAFT[p.id].pins.splice(+b.dataset.unpin, 1); renderSheet(); return; }
    if (b.hasAttribute('data-send')) {
      const dr = DRAFT[p.id];
      if (!dr.pins.length && !dr.caption_note.trim() && !dr.note.trim()) { toast(T('Posez un repère sur l’image ou écrivez une remarque', 'Pose un repère sur l’image ou écris une remarque')); return; }
      await sendReview(p, 'change', b);
    }
  };
  el.oninput = e => {
    const p = POSTS.find(x => x.id === openPost), dr = p && DRAFT[p.id]; if (!dr) return;
    const t = e.target;
    if (t.dataset.pin != null) dr.pins[+t.dataset.pin].t = t.value;
    if (t.dataset.dr) dr[t.dataset.dr] = t.value;
  };
  el.onkeydown = e => {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Tab') { const f = [...el.querySelectorAll('button:not(:disabled),a[href],input,textarea,video')]; const i = f.indexOf(document.activeElement); if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); } }
  };
}
async function sendReview(p, decision, btn) {
  const dr = DRAFT[p.id] || {pins:[], caption_note:'', note:''};
  const row = {post_id:p.id, project_id:P.id, v:p.v, decision, author_email:email,
    pins:decision === 'ok' ? [] : dr.pins.map(x => ({m:x.m, x:x.x, y:x.y, t:String(x.t || '').trim().slice(0, 140)})),
    caption_note:decision === 'ok' ? '' : dr.caption_note.trim().slice(0, 600), note:decision === 'ok' ? '' : dr.note.trim().slice(0, 600)};
  if (btn) btn.disabled = true;
  const {data, error} = await sb.from('post_reviews').insert(row).select().single();
  if (error) {
    if (btn) btn.disabled = false;
    if (!isOpen(p)) { toast('Le délai de réponse est dépassé : ce post est validé automatiquement.'); delete DRAFT[p.id]; renderSheet(); renderClient(); }
    else toast('L’envoi n’a pas fonctionné. Vérifiez votre connexion et réessayez.');
    return;
  }
  (REV[p.id] = REV[p.id] || []).push(data || {...row, created_at:new Date().toISOString()});
  delete DRAFT[p.id]; delete REEDIT[p.id]; renderSheet(); renderClient();
  toast(decision === 'ok' ? 'Merci, c’est validé' : T('Merci, votre demande est envoyée', 'Merci, ta demande est envoyée'));
  const lines = [`Projet : ${D.project || '—'} (${D.client || '—'})`, `Post : ${p.title || FORMATS[p.format] || 'Post'} · version ${p.v}`, `Publication prévue : ${fwhen(p.publish_at)}`, `Réponse : ${decision === 'ok' ? 'Validé' : 'Modification demandée'}`];
  row.pins.forEach((x, i) => lines.push(`Repère ${i + 1} : ${x.t || '(sans texte)'}`));
  if (row.caption_note) lines.push('Légende : « ' + row.caption_note + ' »');
  if (row.note) lines.push('Remarque : « ' + row.note + ' »');
  mail(`${decision === 'ok' ? 'post validé' : 'modification demandée'} (${p.title || 'post'})`, lines);
}

/* ---------- calendrier éditorial ---------- */
function calendarClient() {
  const list = POSTS.filter(p => p.state !== 'draft' && p.publish_at);
  let h = '<h2>Calendrier</h2>';
  if (!list.length) return D.nets.length && !D.livrables.length ? h + `<p class="empty">${T('Votre calendrier de publications apparaîtra ici.', 'Ton calendrier de publications apparaîtra ici.')}</p>` : '';
  if (!CAL) { const up = list.find(p => Date.parse(p.publish_at) >= Date.now() - 86400e3), d = up ? new Date(up.publish_at) : new Date(); CAL = {y:d.getFullYear(), m:d.getMonth()}; }
  return h + `<div class="card" id="cal">${calInner(list)}</div>`;
}
function calInner(list) {
  const {y, m} = CAL, first = new Date(y, m, 1), start = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  const inMonth = list.filter(p => { const d = new Date(p.publish_at); return d.getFullYear() === y && d.getMonth() === m; });
  const now = new Date();
  let h = `<div class="calbar"><button class="icon" data-cal="-1" aria-label="Mois précédent">‹</button><b>${first.toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}</b><span class="note">${inMonth.length} post${inMonth.length > 1 ? 's' : ''}</span><button class="icon" data-cal="1" aria-label="Mois suivant">›</button></div>`;
  h += `<div class="calg">${['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map(w => `<span class="wd">${w}</span>`).join('')}`;
  for (let i = 0; i < start; i++) h += '<div class="cd out" aria-hidden="true"></div>';
  for (let d = 1; d <= days; d++) {
    const items = inMonth.filter(p => new Date(p.publish_at).getDate() === d).sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
    const dt = new Date(y, m, d), isT = dt.toDateString() === now.toDateString();
    h += `<div class="cd${items.length ? '' : ' empty'}${isT ? ' today' : ''}"><span class="dn"><em>${dt.toLocaleDateString('fr-FR', {weekday:'long'})}</em> ${d}</span>${items.map(p => { const st = pstat(p); return `<button class="cp ${st.c}" data-open="${esc(p.id)}" aria-label="${esc((p.title || FORMATS[p.format]) + ', ' + st.l)}"><i class="sd ${st.c}" aria-hidden="true"></i><span><time>${new Date(p.publish_at).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</time> ${esc(p.title || FORMATS[p.format] || 'Post')}</span><span class="nets">${netTags(p.networks)}</span></button>`; }).join('')}</div>`;
  }
  h += '</div>';
  if (!inMonth.length) h += `<p class="empty center">Aucun post prévu ce mois-ci.</p>`;
  h += `<p class="legend"><span><i class="sd wait"></i>À valider</span><span><i class="sd red"></i>Modification demandée</span><span><i class="sd ok"></i>Validé</span><span><i class="sd done"></i>Publié</span></p>`;
  return h;
}

/* ---------- rapports mensuels ---------- */
const repsSorted = () => D.reports.filter(r => r.month).sort((a, b) => a.month.localeCompare(b.month));
const isNum = v => v !== '' && v != null && !isNaN(+v);
function rv(rep, net, key) {
  if (!rep) return null;
  if (key === 'eng') { const i = rv(rep, net, 'interactions'), r = rv(rep, net, 'reach'); return i != null && r ? i / r * 100 : null; }
  const nets = rep.nets || {};
  if (net !== 'all') return nets[net] && isNum(nets[net][key]) ? +nets[net][key] : null;
  const v = Object.values(nets).map(o => o && o[key]).filter(isNum);
  return v.length ? v.reduce((s, x) => s + (+x), 0) : null;
}
const repNets = reps => { const s = new Set(); reps.forEach(r => Object.entries(r.nets || {}).forEach(([n, o]) => { if (NETS[n] && o && METRICS.some(m => isNum(o[m[0]]))) s.add(n); })); return Object.keys(NETS).filter(n => s.has(n)); };
function reportsClient() {
  const reps = repsSorted(); if (!reps.length) return '';
  if (!REP.m || !reps.find(r => r.month === REP.m)) REP.m = reps[reps.length - 1].month;
  const nets = repNets(reps); if (REP.n !== 'all' && !nets.includes(REP.n)) REP.n = 'all';
  const i = reps.findIndex(r => r.month === REP.m), cur = reps[i], prev = reps[i - 1], n = REP.n;
  let h = `<h2>Rapports <small>${esc(fmonth(REP.m))}</small></h2><div class="card" id="rep">`;
  h += `<div class="rbar"><label class="f inl">Mois<select class="in" data-rm>${reps.slice().reverse().map(r => `<option value="${esc(r.month)}" ${r.month === REP.m ? 'selected' : ''}>${esc(fmonth(r.month))}</option>`).join('')}</select></label>`;
  if (nets.length > 1) h += `<div class="seg gtabs">${['all', ...nets].map(x => `<button data-rn="${x}" aria-pressed="${x === n}">${x === 'all' ? 'Tous les réseaux' : esc(NETS[x][0])}</button>`).join('')}</div>`;
  h += '</div>';
  const tile = (key, label, fmt) => {
    const v = rv(cur, n, key), pv = rv(prev, n, key);
    if (v == null) return '';
    let d = '';
    if (pv != null) {
      if (key === 'followers') { const x = v - pv; d = `<em class="${x > 0 ? 'up' : x < 0 ? 'down' : ''}">${x > 0 ? '▲ +' : x < 0 ? '▼ −' : '= '}${num(Math.abs(x))} en un mois</em>`; }
      else if (key === 'eng') { const x = v - pv; d = `<em class="${x > 0 ? 'up' : x < 0 ? 'down' : ''}">${x > 0 ? '▲ +' : x < 0 ? '▼ −' : '= '}${pct(Math.abs(x)).replace(' %', ' pt')} vs ${fmon(prev.month)}</em>`; }
      else if (pv) { const x = (v - pv) / pv * 100; d = `<em class="${x > 0 ? 'up' : x < 0 ? 'down' : ''}">${x > 0 ? '▲ +' : x < 0 ? '▼ −' : '= '}${Math.round(Math.abs(x))} % vs ${fmon(prev.month)}</em>`; }
    }
    return `<div class="kpi"><span>${label}</span><b>${fmt(v)}</b>${d}</div>`;
  };
  const tiles = tile('followers', 'Abonnés', num) + tile('reach', 'Portée', num) + tile('interactions', 'Interactions', num) + tile('eng', 'Taux d’engagement', pct);
  h += tiles ? `<div class="kpis">${tiles}</div>` : `<p class="empty">Pas de chiffres pour ce réseau ce mois-ci.</p>`;
  h += `<p class="note">Portée : nombre de personnes qui ont vu ${T('vos', 'tes')} contenus. Taux d’engagement : interactions divisées par la portée.</p>`;
  const win = reps.slice(Math.max(0, i - 11), i + 1);
  const series = key => win.map(r => ({label:fmon(r.month), full:fmonth(r.month), v:rv(r, n, key), cur:r.month === REP.m}));
  const s1 = series('followers'), s2 = series('reach'), s3 = series('eng');
  const enough = s => s.filter(x => x.v != null).length >= 2;
  if (win.length >= 2) {
    h += '<div class="charts">';
    if (enough(s1)) h += chart('line', s1, num, 'Abonnés, fin de mois');
    if (enough(s2)) h += chart('bar', s2, num, 'Portée par mois');
    if (enough(s3)) h += chart('line', s3, pct, 'Taux d’engagement');
    h += '</div>';
  } else h += `<p class="note">Les courbes d’évolution apparaîtront dès le deuxième mois de suivi.</p>`;
  const top = (cur.top || []).filter(t => t.title || t.img);
  if (top.length) h += `<h3 class="h3">Les posts qui ont le mieux marché</h3><div class="tops">${top.map((t, k) => `<div class="tp"><span class="rk">${k + 1}</span>${fileUrl(t.img) ? `<img src="${esc(fileUrl(t.img))}" alt="" loading="lazy">` : ''}<div><b>${esc(t.title || 'Post')}</b><small>${t.net && NETS[t.net] ? esc(NETS[t.net][0]) + ' · ' : ''}${esc(t.stat || '')}</small>${okUrl(t.link) ? `<a class="note" href="${esc(okUrl(t.link))}" target="_blank" rel="noopener">Voir le post ↗</a>` : ''}</div></div>`).join('')}</div>`;
  if (cur.comment) h += `<div class="msg"><i>Le mot de Coup de Com’</i>${esc(cur.comment)}</div>`;
  return h + '</div>';
}

/* Graphiques simples en SVG : une seule série, axes discrets, info-bulle au survol ou au toucher, tableau pour l'accessibilité */
function chart(kind, pts, fmt, title) {
  const W = 380, H = 210, L = 44, R = 10, TP = 20, B = 26, n = pts.length;
  const vals = pts.map(p => p.v).filter(v => v != null);
  let max = Math.max(...vals), min = kind === 'bar' ? 0 : Math.min(...vals);
  if (kind === 'line') { const pad = (max - min) * 0.25 || Math.max(1, Math.abs(max) * 0.1); min = Math.max(0, min - pad); max += pad; } else max = max * 1.12 || 1;
  const band = (W - L - R) / n;
  const x = i => kind === 'bar' ? L + band * (i + 0.5) : n > 1 ? L + 10 + (W - L - R - 20) * i / (n - 1) : L + (W - L - R) / 2;
  const y = v => TP + (H - TP - B) * (1 - (v - min) / (max - min || 1));
  const short = v => fmt === pct ? Math.round(v) + ' %' : v >= 10000 ? Math.round(v / 1000) + ' k' : v >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + ' k' : num(v);
  let s = '';
  for (let k = 0; k <= 3; k++) { const v = min + (max - min) * k / 3, yy = y(v); s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ax" x="${L - 8}" y="${yy + 4}" text-anchor="end">${short(v)}</text>`; }
  const step = n > 6 ? 2 : 1;
  pts.forEach((p, i) => { if ((n - 1 - i) % step === 0) s += `<text class="ax${p.cur ? ' axc' : ''}" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(p.label)}</text>`; });
  if (kind === 'bar') {
    const bw = Math.max(6, Math.min(28, band - 4));
    pts.forEach((p, i) => { if (p.v == null) return; const x0 = x(i) - bw / 2, y0 = y(p.v), y1 = y(0), r = Math.min(4, (y1 - y0) / 2); s += `<path class="bar${p.cur ? ' cur' : ''}" data-mk="${i}" d="M${x0},${y1} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + bw - r} Q${x0 + bw},${y0} ${x0 + bw},${y0 + r} V${y1} Z"/>`; });
    const c = pts.findIndex(p => p.cur); if (c >= 0 && pts[c].v != null) s += `<text class="vl" x="${x(c)}" y="${y(pts[c].v) - 7}" text-anchor="middle">${short(pts[c].v)}</text>`;
  } else {
    let d = '', started = false;
    pts.forEach((p, i) => { if (p.v == null) { started = false; return; } d += (started ? ' L' : ' M') + x(i).toFixed(1) + ',' + y(p.v).toFixed(1); started = true; });
    s += `<path class="ln" d="${d.trim()}"/>`;
    pts.forEach((p, i) => { if (p.v != null) s += `<circle class="dot${p.cur ? ' cur' : ''}" data-mk="${i}" cx="${x(i)}" cy="${y(p.v)}" r="${p.cur ? 5 : 4}"/>`; });
    const c = pts.findIndex(p => p.cur); if (c >= 0 && pts[c].v != null) s += `<text class="vl" x="${Math.min(x(c), W - R - 16)}" y="${y(pts[c].v) - 11}" text-anchor="middle">${fmt === pct ? pct(pts[c].v) : short(pts[c].v)}</text>`;
  }
  pts.forEach((p, i) => { s += `<rect class="hit" x="${x(i) - band / 2}" y="${TP - 10}" width="${band}" height="${H - TP - B + 10}" data-i="${i}" tabindex="0" role="img" aria-label="${esc(p.full + ' : ' + (p.v == null ? 'pas de donnée' : fmt(p.v)))}"/>`; });
  const tips = pts.map(p => p.full + ' : ' + (p.v == null ? '—' : fmt(p.v)));
  return `<figure class="chart" data-tips="${esc(JSON.stringify(tips))}"><figcaption>${esc(title)}</figcaption><div class="cw"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-label="${esc(title)}">${s}</svg><div class="tip" hidden></div></div><details class="tbl"><summary>Voir en tableau</summary><table><thead><tr><th>Mois</th><th>${esc(title)}</th></tr></thead><tbody>${pts.map(p => `<tr><td>${esc(p.full)}</td><td>${p.v == null ? '—' : fmt(p.v)}</td></tr>`).join('')}</tbody></table></details></figure>`;
}
function bindTips(root) {
  const show = t => {
    const fig = t.closest('.chart'), tip = fig.querySelector('.tip'), tips = JSON.parse(fig.dataset.tips), i = +t.dataset.i;
    tip.textContent = tips[i]; tip.hidden = false;
    fig.querySelectorAll('[data-mk]').forEach(m => m.classList.toggle('hov', +m.dataset.mk === i));
    const cw = fig.querySelector('.cw').getBoundingClientRect(), r = t.getBoundingClientRect();
    const left = Math.max(4, Math.min(cw.width - tip.offsetWidth - 4, r.left - cw.left + r.width / 2 - tip.offsetWidth / 2));
    tip.style.left = left + 'px'; tip.style.top = '0px';
  };
  const hide = t => { const fig = t.closest('.chart'); if (!fig) return; fig.querySelector('.tip').hidden = true; fig.querySelectorAll('.hov').forEach(m => m.classList.remove('hov')); };
  root.onpointerover = e => { const t = e.target.closest && e.target.closest('.hit'); if (t) show(t); };
  root.onpointerout = e => { const t = e.target.closest && e.target.closest('.hit'); if (t) hide(t); };
  root.addEventListener('focusin', e => { if (e.target.classList && e.target.classList.contains('hit')) show(e.target); });
  root.addEventListener('focusout', e => { if (e.target.classList && e.target.classList.contains('hit')) hide(e.target); });
}

/* ---------- questionnaire : découverte (prospect) puis brief de démarrage (client signé) ---------- */
const prospect = () => !!D && D.stage === 'prospect';
const OPTS = {
  ton:['Chaleureux', 'Élégant', 'Familial', 'Fun', 'Engagé', 'Simple et direct', 'Premium', 'Décalé'],
  services:['Réseaux sociaux', 'Logo et identité visuelle', 'Shooting photo', 'Vidéos et reels', 'Site internet', 'Affiches, flyers, menus', 'Pas encore sûr'],
  objectifs:['Plus de réservations ou de ventes', 'Se faire connaître', 'Moderniser son image', 'Lancer une nouveauté', 'Fidéliser ses clients', 'Recruter'],
  budget:['Moins de 300 € par mois', '300 à 600 € par mois', '600 à 1 000 € par mois', 'Plus de 1 000 € par mois', 'Un projet ponctuel', 'À définir ensemble'],
  delai:['Dès que possible', 'Dans le mois', 'Dans 2 à 3 mois', 'Rien ne presse']};
function questions() {
  const base = {
    etab:{l:T('Votre établissement en deux phrases', 'Ton établissement en deux phrases'), ph:'ex. Restaurant de saison au bord du canal, ambiance guinguette'},
    forces:{l:T('Ce qui vous rend unique : vos 3 points forts', 'Ce qui te rend unique : tes 3 points forts'), ph:'ex. Produits locaux, grande terrasse, accueil des groupes'},
    cible:{l:T('Votre clientèle idéale', 'Ta clientèle idéale'), ph:'ex. Familles le week-end, couples, groupes pour les anniversaires'},
    offres:{l:'Offres et temps forts à mettre en avant', ph:'ex. Brunch du dimanche, soirées concerts, menus de fêtes'},
    ton:{l:T('Le ton que vous voulez sur vos réseaux', 'Le ton que tu veux sur tes réseaux'), type:'chips'},
    eviter:{l:'À ne jamais publier', ph:'ex. Pas de clients reconnaissables sans accord, pas de prix barrés'},
    reseaux:{l:T('Vos réseaux actuels (liens)', 'Tes réseaux actuels (liens)'), ph:'ex. instagram.com/mon-etablissement'},
    inspi:{l:T('Des comptes que vous aimez (inspirations, concurrents)', 'Des comptes que tu aimes (inspirations, concurrents)'), ph:''},
    pratique:{l:'Infos pratiques : adresse, horaires, réservation', ph:''},
    valideur:{l:'Qui valide les posts au quotidien ?', ph:'Prénom et téléphone', type:'text'},
    services:{l:T('Ce qui vous intéresse', 'Ce qui t’intéresse'), type:'chips'},
    objectifs:{l:T('Vos objectifs', 'Tes objectifs'), type:'chips'},
    vision:{l:T('Votre vision : où aimeriez-vous en être dans un an ?', 'Ta vision : où aimerais-tu en être dans un an ?'), ph:'ex. Un restaurant complet chaque week-end et une vraie communauté sur Instagram'},
    budget:{l:'Budget envisagé', type:'chips', single:true},
    delai:{l:'Pour quand ?', type:'chips', single:true}};
  const order = prospect() ? ['etab', 'services', 'objectifs', 'vision', 'budget', 'delai', 'forces', 'cible', 'offres', 'ton', 'reseaux', 'inspi', 'pratique']
    : ['etab', 'forces', 'cible', 'offres', 'ton', 'eviter', 'reseaux', 'inspi', 'pratique', 'valideur', 'services', 'objectifs', 'vision', 'budget', 'delai'];
  return order.map(k => ({k, ...base[k]}));
}
const DISCO = ['services', 'objectifs', 'vision', 'budget', 'delai'];
const answered = (d, x) => x.type === 'chips' ? (d[x.k] || []).length > 0 : String(d[x.k] || '').trim() !== '';
/* le formulaire : pour un client signé, les questions de découverte n'apparaissent que si elles ont déjà une réponse */
const briefQ = () => { const d = BD(); return questions().filter(x => prospect() || !DISCO.includes(x.k) || answered(d, x)); };
const BD = () => (BRIEF && BRIEF.data) || {};
const BDW = () => { if (!BRIEF) BRIEF = {project_id:P.id, data:{}, submitted:false}; if (!BRIEF.data) BRIEF.data = {}; return BRIEF.data; };
const ansText = (d, x) => x.type === 'chips' ? [...(d[x.k] || []), x.k === 'ton' ? d.tonPlus : ''].filter(Boolean).join(', ') : String(d[x.k] || '');
const durTxt = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function briefClient() {
  const d = BD(), done = BRIEF && BRIEF.submitted, ro = done || isAdmin, pro = prospect();
  if (done) return pro
    ? `<h2>Merci, c’est bien reçu <small>le ${fdt(BRIEF.submitted_at)}</small></h2><div class="card"><p style="margin-top:0">${T('Nous étudions vos réponses et revenons vers vous très vite avec une proposition.', 'Nous étudions tes réponses et revenons vers toi très vite avec une proposition.')}</p><details><summary>Revoir les réponses</summary>${briefAnswers(d)}</details></div>`
    : `<h2>${T('Votre brief', 'Ton brief')} <small>envoyé le ${fdt(BRIEF.submitted_at)}</small></h2><details class="card"><summary>Revoir les réponses</summary>${briefAnswers(d)}</details>`;
  const q = briefQ(), filled = q.filter(x => answered(d, x)).length;
  let h = `<h2>${pro ? T('Parlez-nous de votre projet', 'Parle-nous de ton projet') : T('Votre brief de démarrage', 'Ton brief de démarrage')} <small>${filled} / ${q.length}</small></h2><div class="card brief" id="brief">`;
  h += `<p class="lead" style="font-size:16px;margin-bottom:6px">${pro
    ? T('Pour vous préparer une proposition sur mesure, racontez-nous votre établissement et vos envies : par écrit, par message vocal, avec vos photos et logos. Répondez à ce que vous voulez, tout s’enregistre automatiquement.', 'Pour te préparer une proposition sur mesure, raconte-nous ton établissement et tes envies : par écrit, par message vocal, avec tes photos et logos. Réponds à ce que tu veux, tout s’enregistre automatiquement.')
    : T('Quelques questions pour que vos posts vous ressemblent dès le premier jour. Tout s’enregistre automatiquement : vous pouvez y revenir quand vous voulez.', 'Quelques questions pour que tes posts te ressemblent dès le premier jour. Tout s’enregistre automatiquement : tu peux y revenir quand tu veux.')}</p>`;
  h += `<p class="note">${T('Astuce : sur téléphone, le micro du clavier permet aussi de dicter vos réponses.', 'Astuce : sur téléphone, le micro du clavier permet aussi de dicter tes réponses.')}</p>`;
  if (pro) h += voiceBlock(d, ro);
  q.forEach(x => {
    if (x.type === 'chips') h += `<div class="f"><span>${esc(x.l)}${x.single ? '' : ' <span class="note">(plusieurs choix possibles)</span>'}</span><div class="chips" data-bk="${x.k}"${x.single ? ' data-single' : ''}>${OPTS[x.k].map(t => `<button type="button" data-bt="${esc(t)}" aria-pressed="${(d[x.k] || []).includes(t)}" ${ro ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>${x.k === 'ton' ? `<input class="in" data-bq="tonPlus" value="${esc(d.tonPlus || '')}" placeholder="Une précision ? (facultatif)" ${ro ? 'disabled' : ''}>` : ''}</div>`;
    else if (x.type === 'text') h += `<label class="f">${esc(x.l)}<input class="in" data-bq="${x.k}" value="${esc(d[x.k] || '')}" placeholder="${esc(x.ph)}" maxlength="300" ${ro ? 'disabled' : ''}></label>`;
    else h += `<label class="f">${esc(x.l)}<textarea class="in" data-bq="${x.k}" maxlength="2000" placeholder="${esc(x.ph)}" ${ro ? 'disabled' : ''}>${esc(d[x.k] || '')}</textarea></label>`;
  });
  if (!pro) {
    h += `<label class="chk"><input type="checkbox" data-bacc ${d.acces ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>J’ai donné accès à Coup de Com’ dans Meta Business Suite (Paramètres › Personnes › Ajouter : <b>${esc(AGENCY_MAIL)}</b>).</span></label>`;
    h += `<p class="note">Nous ne demandons jamais ${T('vos', 'tes')} mots de passe : l’accès se donne par invitation et se retire en un clic.</p>`;
    if ((d.voice || []).length) h += voiceBlock(d, ro);
  }
  h += `<div class="f"><span>${pro ? T('Vos éléments : logo, photos, menus, flyers, tout ce que vous avez déjà', 'Tes éléments : logo, photos, menus, flyers, tout ce que tu as déjà') : T('Vos fichiers : logo, photos du lieu, menus, charte', 'Tes fichiers : logo, photos du lieu, menus, charte')} <span class="note">(50 Mo max par fichier)</span></span>${briefFiles(d)}<div class="acts" style="margin:6px 0 0"><button class="btn sm" data-bfile ${ro ? 'disabled' : ''}>Ajouter des fichiers</button><span class="note" id="bProg" aria-live="polite"></span></div></div>`;
  h += `<div class="gval"><button class="btn primary" data-bsend ${ro ? 'disabled' : ''}>${pro ? 'Envoyer à Coup de Com’' : 'Envoyer le brief'}</button><span class="note">${pro ? T('Pas besoin de tout remplir : envoyez quand vous êtes prêt, nous en parlerons ensemble.', 'Pas besoin de tout remplir : envoie quand tu es prêt, on en parlera ensemble.') : T('Une fois envoyé, le brief est transmis à Coup de Com’. Besoin d’y retoucher ensuite ? Écrivez-nous.', 'Une fois envoyé, le brief est transmis à Coup de Com’. Besoin d’y retoucher ensuite ? Écris-nous.')}</span></div>`;
  return h + '</div>';
}
function briefFiles(d) {
  const f = d.files || [];
  return f.length ? `<ul class="files">${f.map(x => `<li>${fileUrl(x.path) ? `<a href="${esc(fileUrl(x.path))}" target="_blank" rel="noopener">${esc(x.name)}</a>` : esc(x.name)} <span class="note">${Math.max(1, Math.round((x.size || 0) / 1024))} Ko</span></li>`).join('')}</ul>` : '<p class="note" style="margin:4px 0">Aucun fichier pour l’instant.</p>';
}
const voiceList = d => (d.voice || []).length ? `<ul class="voices">${d.voice.map((x, i) => `<li><audio controls preload="none" src="${esc(fileUrl(x.path))}"></audio><span class="note">Message ${i + 1} · ${durTxt(x.dur)}</span></li>`).join('')}</ul>` : '';
function briefAnswers(d) {
  const q = questions().filter(x => answered(d, x) || !DISCO.includes(x.k) || prospect());
  return `<dl class="answers">${q.map(x => `<dt>${esc(x.l)}</dt><dd>${esc(ansText(d, x) || '—')}</dd>`).join('')}${prospect() && !d.acces ? '' : `<dt>Accès Meta Business Suite</dt><dd>${d.acces ? 'Donné' : 'Pas encore'}</dd>`}${(d.voice || []).length ? `<dt>Messages vocaux</dt><dd>${voiceList(d)}</dd>` : ''}<dt>Fichiers</dt><dd>${briefFiles(d)}</dd></dl>`;
}

/* messages vocaux : enregistrés dans le navigateur, écoutés avant envoi */
let REC = null;
function voiceBlock(d, ro) {
  let h = `<div class="f vb"><span>${T('Vos messages vocaux', 'Tes messages vocaux')} <span class="note">(facultatif, 5 minutes max par message)</span></span><p class="note">${T('Plus simple que d’écrire : parlez-nous de votre projet, de vos envies, de ce que vous aimez ou pas.', 'Plus simple que d’écrire : parle-nous de ton projet, de tes envies, de ce que tu aimes ou pas.')}</p>${voiceList(d)}`;
  if (!ro) h += `<div class="rec" id="rec">${recInner()}</div>`;
  return h + '</div>';
}
function recInner() {
  if (!REC) return `<button class="btn" data-rec="start" type="button">🎙️ Enregistrer un message vocal</button>`;
  if (REC.state === 'rec') return `<span class="recdot" aria-hidden="true"></span><b id="recT" aria-live="off">${durTxt((Date.now() - REC.t0) / 1000)}</b><span class="note">Enregistrement en cours…</span><button class="btn primary" data-rec="stop" type="button">Arrêter</button>`;
  return `<audio controls src="${REC.url}"></audio><div class="acts" style="margin:6px 0 0"><button class="btn primary" data-rec="send" type="button">Envoyer ce message</button><button class="btn ghost" data-rec="redo" type="button">Recommencer</button></div>`;
}
const recRefresh = () => { const r = $('#rec'); if (r) r.innerHTML = recInner(); };
async function recStart() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { toast(T('L’enregistrement n’est pas possible sur ce navigateur : utilisez le micro de votre clavier pour dicter.', 'L’enregistrement n’est pas possible sur ce navigateur : utilise le micro de ton clavier pour dicter.')); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch { toast(T('Le micro n’est pas autorisé : autorisez-le dans votre navigateur, puis réessayez.', 'Le micro n’est pas autorisé : autorise-le dans ton navigateur, puis réessaie.')); return; }
  const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  const mr = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
  const r = REC = {state:'rec', mr, chunks:[], t0:Date.now(), mime:mr.mimeType || mime || 'audio/webm'};
  mr.ondataavailable = e => { if (e.data && e.data.size) r.chunks.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(r.timer); if (REC !== r) return; r.blob = new Blob(r.chunks, {type:r.mime}); r.url = URL.createObjectURL(r.blob); r.dur = (Date.now() - r.t0) / 1000; r.state = 'ready'; recRefresh(); };
  mr.start(1000);
  r.timer = setInterval(() => { const s = (Date.now() - r.t0) / 1000, el = $('#recT'); if (el) el.textContent = durTxt(s); if (s >= 300 && mr.state === 'recording') mr.stop(); }, 500);
  recRefresh();
}
function recStop(all) { if (REC && REC.state === 'rec' && REC.mr.state === 'recording') REC.mr.stop(); if (all) { if (REC && REC.url) URL.revokeObjectURL(REC.url); REC = null; } }
async function recSend(btn) {
  const r = REC; if (!r || !r.blob) return;
  const ext = /mp4/.test(r.mime) ? 'm4a' : /ogg/.test(r.mime) ? 'ogg' : 'webm';
  btn.disabled = true; btn.textContent = 'Envoi…';
  try {
    const path = await upload(`${P.id}/depot/${uid()}-message-vocal.${ext}`, r.blob, r.mime.split(';')[0]);
    const d = BDW(); d.voice = [...(d.voice || []), {path, size:r.blob.size, dur:Math.round(r.dur), at:new Date().toISOString(), by:email}];
    URL.revokeObjectURL(r.url); REC = null;
    await signFiles([path]); saveBrief(); await flushAll(); renderClient(); toast('Message vocal envoyé');
  } catch { btn.disabled = false; btn.textContent = 'Envoyer ce message'; toast('L’envoi n’a pas abouti. Réessayez dans un instant.'); }
}
function saveBrief() {
  later('brief', async () => {
    const {data, error} = await sb.from('briefs').upsert({project_id:P.id, data:BD(), submitted:false}, {onConflict:'project_id'}).select().single();
    if (error) { toast(T('Vos réponses n’ont pas pu être enregistrées. Vérifiez votre connexion.', 'Tes réponses n’ont pas pu être enregistrées. Vérifie ta connexion.')); return false; }
    BRIEF = {...data, data:BD()}; return true;
  }, 900);
}
async function briefUpload() {
  const files = await pick('*/*', true); if (!files.length) return;
  const d = BDW(); d.files = d.files || [];
  let ok = 0;
  for (const f of files) {
    if (f.size > MAX_FILE) { toast(`${f.name} : trop lourd (50 Mo max)`); continue; }
    const pr = $('#bProg'); if (pr) pr.textContent = `Envoi de ${f.name}…`;
    try { const path = await upload(`${P.id}/depot/${uid()}-${safeName(f.name)}`, f); d.files.push({path, name:f.name, size:f.size, at:new Date().toISOString(), by:email}); ok++; }
    catch { toast(`${f.name} : l’envoi n’a pas abouti`); }
  }
  await signFiles(d.files.map(x => x.path));
  saveBrief(); await flushAll(); renderClient();
  if (ok) toast(`${ok} fichier${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}`);
}

/* ---------- livrables (aperçu filigrané, fichier source après paiement) ---------- */
function livrablesClient() {
  const l = D.livrables.filter(x => x.preview || x.src);
  if (!l.length) return '';
  let h = `<h2>Livrables</h2><div class="lgrid">`;
  h += l.map(x => `<div class="card liv">${fileUrl(x.preview) ? `<img src="${esc(fileUrl(x.preview))}" alt="Aperçu : ${esc(x.title || 'livrable')}" loading="lazy">` : '<div class="ph big">Aperçu à venir</div>'}<b>${esc(x.title || 'Livrable')}</b>${x.note ? `<small>${esc(x.note)}</small>` : ''}${x.src ? (OPEN && fileUrl(x.src) ? `<a class="btn sm primary" href="${esc(fileUrl(x.src))}" target="_blank" rel="noopener" download>Télécharger ${esc(x.fname ? '(' + x.fname.split('.').pop().toUpperCase() + ')' : '')}</a>` : `<p class="lock">🔒 Fichier en haute définition disponible dès le règlement complet.</p>`) : ''}</div>`).join('');
  h += '</div>';
  if (!OPEN && l.some(x => x.src)) h += `<p class="note">${T('Les aperçus portent un filigrane. Les fichiers définitifs (haute définition, sans filigrane, formats sources) s’ouvrent automatiquement ici une fois vos factures réglées.', 'Les aperçus portent un filigrane. Les fichiers définitifs (haute définition, sans filigrane, formats sources) s’ouvrent automatiquement ici une fois tes factures réglées.')}</p>`;
  return h;
}
function deliverCard() {
  const link = DLV && okUrl(DLV.link);
  if (!link || (isAdmin && DLV.after_paid && !allPaid())) return '';
  return `<div class="card dlv"><div class="eyebrow">Livraison</div><h3>${T('Vos fichiers sont prêts', 'Tes fichiers sont prêts')}</h3>${DLV.msg ? `<p>${esc(DLV.msg)}</p>` : ''}<div class="acts"><a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener">${esc((D.dlvBtn || '').trim() || 'Télécharger mes fichiers')} ↗</a></div><p class="note">Le lien de téléchargement est valable pour une durée limitée : ${T('pensez à enregistrer vos fichiers', 'pense à enregistrer tes fichiers')}.</p></div>`;
}
const allPaid = () => { const inv = BILL.filter(b => b.kind === 'invoice'); return inv.length > 0 && inv.every(b => b.status === 'paid'); };

/* ---------- avancement ---------- */
function tasksClient() {
  const tasks = D.tasks; if (!tasks.length) return '';
  const done = tasks.filter(t => t.s === 'done').length, p = Math.round(done / tasks.length * 100);
  const li = t => `<li><span class="dot ${t.s}"></span><span class="${t.s === 'done' ? 'done-t' : ''}">${esc(t.t)}</span><span class="d">${t.s === 'doing' ? 'En cours' : fd(t.d)}</span></li>`;
  const open = tasks.filter(t => t.s === 'doing').concat(tasks.filter(t => t.s === 'todo')), fin = tasks.filter(t => t.s === 'done');
  return `<h2>Avancement <small>${p} %</small></h2><div class="prog" role="img" aria-label="${p} % terminé"><i style="width:${p}%"></i></div><div class="card"><ul class="tasks">${open.map(li).join('') || '<li><span class="dot done"></span><span>Tout est terminé.</span><span></span></li>'}</ul>${fin.length ? `<details><summary>Terminé (${fin.length})</summary><ul class="tasks">${fin.map(li).join('')}</ul></details>` : ''}</div>`;
}

/* ---------- devis et factures ---------- */
function billingClient(quotesOnly) {
  const quotes = BILL.filter(b => b.kind === 'quote'), inv = quotesOnly ? [] : BILL.filter(b => b.kind === 'invoice');
  if (quotesOnly && !quotes.length) return '';
  let h = `<h2>${quotesOnly ? 'Notre proposition' : 'Devis et factures'}</h2>`;
  if (!quotes.length && !inv.length) return h + '<p class="empty">Aucun document pour l’instant.</p>';
  const doc = b => fileUrl(b.file) ? `<a class="btn sm" href="${esc(fileUrl(b.file))}" target="_blank" rel="noopener">Voir le ${b.kind === 'quote' ? 'devis' : 'PDF'}</a>` : '';
  if (quotes.length) h += `<div class="card"><h3 class="h3" style="margin-top:0">Devis</h3>${quotes.map(b => `<div class="inv"><div><b>${esc(b.label || 'Devis')}</b><small>${b.number ? 'N° ' + esc(b.number) + ' · ' : ''}${fd(b.issued)}</small></div><span class="amt">${eur(b.amount)}</span>${quoteLines(b)}<span class="pill ${b.accepted_at ? 'ok' : 'wait'}">${b.accepted_at ? 'Accepté le ' + fd(b.accepted_at) : 'À accepter'}</span><div class="acts">${doc(b)}${!b.accepted_at && can.accept() ? `<button class="btn sm primary" data-accept="${esc(b.id)}">J’accepte ce devis</button>` : ''}</div></div>`).join('')}${quotes.some(b => !b.accepted_at) && can.accept() ? `<p class="note">En cliquant sur « J’accepte ce devis », ${T('vous donnez votre accord', 'tu donnes ton accord')} pour démarrer la mission aux conditions du devis. La date et ${T('votre', 'ton')} adresse e-mail sont enregistrées.</p>` : ''}</div>`;
  if (inv.length) {
    const rest = inv.filter(b => b.status !== 'paid').reduce((s, b) => s + (+b.amount || 0), 0);
    h += `<div class="card"><h3 class="h3" style="margin-top:0">Factures</h3>${inv.map(b => { const late = b.status !== 'paid' && b.due && b.due < today(); return `<div class="inv"><div><b>${esc(b.label || 'Facture')}</b><small>${b.number ? 'N° ' + esc(b.number) + ' · ' : ''}${fd(b.issued)}${b.status !== 'paid' && b.due ? ' · à régler avant le ' + fd(b.due) : ''}</small></div><span class="amt">${eur(b.amount)}</span><span class="pill ${b.status === 'paid' ? 'ok' : late ? 'red' : 'wait'}">${b.status === 'paid' ? 'Payée' : late ? 'En retard' : 'À régler'}</span>${doc(b) ? `<div class="acts">${doc(b)}</div>` : ''}</div>`; }).join('')}<div class="sum"><span>Reste à régler</span><span>${eur(rest)}</span></div></div>`;
    if (rest > 0) h += payBlock();
  }
  return h;
}
function quoteLines(b) {
  const L = Array.isArray(b.lines) ? b.lines.filter(l => l && l.label) : []; if (!L.length) return '';
  const row = l => `<tr><td>${esc(l.label)}${+l.qty > 1 ? ` <span class="note">× ${+l.qty}</span>` : ''}</td><td>${l.type === 'mois' ? eur((+l.price || 0) * (+l.qty || 1)) + ' / mois' : eur((+l.price || 0) * (+l.qty || 1))}</td></tr>`;
  const x = b.extra || {};
  return `<details class="qlines"><summary>Voir le détail</summary><table>${L.map(row).join('')}</table>${x.months && L.some(l => l.type === 'mois') ? `<p class="note">Abonnement sur ${+x.months} mois${x.discount ? ` · remise ${+x.discount} %` : ''}.</p>` : ''}${x.vat ? '<p class="note">Montant TTC (TVA 20 % incluse).</p>' : '<p class="note">Montant hors taxes.</p>'}${x.notes ? `<p class="qnote">${esc(x.notes)}</p>` : ''}</details>`;
}
function payBlock() {
  const a = AGENCY || {}; if (!a.iban && !okUrl(a.revolut)) return '';
  let h = `<div class="card pay"><h3 class="h3" style="margin-top:0">Comment régler</h3>`;
  if (a.iban) h += `<p style="margin:0 0 8px"><b>Par virement</b> ${T('(indiquez le numéro de facture en référence)', '(indique le numéro de facture en référence)')}</p><dl class="rib">${a.holder ? `<dt>Titulaire</dt><dd>${esc(a.holder)}</dd>` : ''}<dt>IBAN</dt><dd><code>${esc(a.iban)}</code> <button class="btn sm ghost" data-copy="${esc(a.iban.replace(/\s/g, ''))}">Copier</button></dd>${a.bic ? `<dt>BIC</dt><dd><code>${esc(a.bic)}</code></dd>` : ''}${a.bank ? `<dt>Banque</dt><dd>${esc(a.bank)}</dd>` : ''}</dl>`;
  if (okUrl(a.revolut)) h += `<p style="margin:14px 0 8px"><b>Par carte</b>, en quelques secondes :</p><a class="btn" href="${esc(okUrl(a.revolut))}" target="_blank" rel="noopener">Payer avec Revolut ↗</a>`;
  if (a.pay_note) h += `<p class="note">${esc(a.pay_note)}</p>`;
  return h + `<p class="note">La facture passe en « Payée » dès réception du paiement.</p></div>`;
}

/* ---------- événements de la vue client ---------- */
async function clientClick(e) {
  const b = e.target.closest('button,a'); if (!b) return;
  if (b.id === 'backEdit') { mode = 'edit'; renderAdmin(); scrollTo(0, 0); return; }
  if (b.dataset.vr) { viewRole = b.dataset.vr; renderClient(); return; }
  if (b.dataset.open) { openSheet(b.dataset.open); return; }
  if (b.dataset.cal) { CAL.m += +b.dataset.cal; if (CAL.m < 0) { CAL.m = 11; CAL.y--; } if (CAL.m > 11) { CAL.m = 0; CAL.y++; } $('#cal').innerHTML = calInner(POSTS.filter(p => p.state !== 'draft' && p.publish_at)); return; }
  if (b.dataset.rn) { REP.n = b.dataset.rn; refreshRep(); return; }
  if (b.dataset.copy) { copy(b.dataset.copy, 'IBAN copié'); return; }
  if (b.dataset.accept) {
    if (isAdmin) { toast('Aperçu : seul ton client peut accepter'); return; }
    confirmBtn(b, async () => {
      b.disabled = true;
      const {data, error} = await sb.rpc('accept_quote', {b:b.dataset.accept});
      if (error || !data) { b.disabled = false; toast('L’acceptation n’a pas fonctionné. Réessayez dans un instant.'); return; }
      const q = BILL.find(x => x.id === b.dataset.accept); q.accepted_at = new Date().toISOString(); q.accepted_by = email;
      renderClient(); toast('Merci, le devis est accepté');
      mail(`devis accepté (${q.label || q.number || 'devis'})`, [`Projet : ${D.project || '—'} (${D.client || '—'})`, `Devis : ${q.label || '—'} ${q.number ? 'n° ' + q.number : ''}`, `Montant : ${eur(q.amount)}`]);
    }, 'Je confirme : j’accepte');
    return;
  }
  if (b.dataset.bt) {
    if (isAdmin) return;
    const box = b.closest('[data-bk]'), k = box.dataset.bk, d = BDW(), t = b.dataset.bt;
    let a = Array.isArray(d[k]) ? d[k] : [];
    a = box.hasAttribute('data-single') ? (a[0] === t ? [] : [t]) : (a.includes(t) ? a.filter(x => x !== t) : [...a, t]);
    d[k] = a; box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', a.includes(x.dataset.bt)));
    saveBrief(); return;
  }
  if (b.dataset.rec) {
    if (isAdmin) { toast('Aperçu : seul ton client peut enregistrer'); return; }
    if (b.dataset.rec === 'start') recStart();
    if (b.dataset.rec === 'stop') recStop();
    if (b.dataset.rec === 'redo') { recStop(true); recRefresh(); }
    if (b.dataset.rec === 'send') recSend(b);
    return;
  }
  if (b.hasAttribute('data-bfile')) { briefUpload(); return; }
  if (b.hasAttribute('data-bsend')) {
    confirmBtn(b, async () => {
      b.disabled = true; await flushAll();
      const {data, error} = await sb.from('briefs').upsert({project_id:P.id, data:BD(), submitted:true}, {onConflict:'project_id'}).select().single();
      if (error) { b.disabled = false; toast('L’envoi n’a pas fonctionné. Réessayez dans un instant.'); return; }
      BRIEF = data; recStop(true); renderClient(); toast(prospect() ? 'Merci, c’est bien reçu !' : 'Merci, le brief est envoyé');
      const d = BD(); mail(prospect() ? 'questionnaire de découverte reçu (prospect)' : 'brief de démarrage reçu', [`Projet : ${D.project || '—'} (${D.client || '—'})`, '', ...briefQ().map(x => `${x.l} : ${ansText(d, x) || '—'}`), ...(prospect() ? [] : [`Accès Meta : ${d.acces ? 'donné' : 'pas encore'}`]), `Messages vocaux : ${(d.voice || []).length}`, `Fichiers : ${(d.files || []).length}`]);
    }, 'Confirmer l’envoi ?');
  }
}
function clientInput(e) {
  const t = e.target;
  if (t.dataset.bq && !isAdmin) { BDW()[t.dataset.bq] = t.value; saveBrief(); }
}
function clientChange(e) {
  const t = e.target;
  if (t.dataset.rm != null) { REP.m = t.value; refreshRep(); return; }
  if (t.hasAttribute('data-bacc') && !isAdmin) { BDW().acces = t.checked; saveBrief(); }
}
function refreshRep() { const r = $('#rep'); if (!r) return; const w = document.createElement('div'); w.innerHTML = reportsClient(); const nr = w.querySelector('#rep'); r.replaceWith(nr); const h2 = nr.previousElementSibling; if (h2 && h2.tagName === 'H2') h2.querySelector('small').textContent = fmonth(REP.m); }

/* =====================================================================
   VUE GESTION (agence)
   ===================================================================== */
let LIST = [], LSTAT = {}, lTab = 'clients', OPENED = null, pFilter = 'todo', RAM = null, CSV = null;

/* ---------- liste des projets ---------- */
async function adminList() {
  hdr(true); P = D = null; mode = 'edit';
  app().innerHTML = '<p class="note">Chargement…</p>';
  const [pr, mem, po, rv, bi, br, ag] = await Promise.all([
    sb.from('projects').select('id,data,archived,updated_at').order('updated_at', {ascending:false}),
    sb.from('members').select('project_id,email,role'),
    sb.from('posts').select('id,project_id,state,v,sent_at,review_hours'),
    sb.from('post_reviews').select('post_id,v,decision,created_at').order('created_at', {ascending:true}).limit(10000),
    sb.from('billing').select('project_id,kind,status,due,accepted_at'),
    sb.from('briefs').select('project_id,submitted,submitted_at'),
    sb.from('agency').select('*').eq('id', 1).maybeSingle()]);
  if (pr.error) { app().innerHTML = `<p class="note">Impossible de charger les projets. As-tu bien collé le script de la base de données dans Supabase ? (${esc(pr.error.message)})</p>`; return; }
  LIST = pr.data; AGENCY = ag.data || {id:1}; mapReviews(rv.data);
  LSTAT = {};
  LIST.forEach(p => {
    const posts = (po.data || []).filter(x => x.project_id === p.id), st = posts.map(pstat);
    const bill = (bi.data || []).filter(x => x.project_id === p.id), b = (br.data || []).find(x => x.project_id === p.id);
    LSTAT[p.id] = {
      mem:(mem.data || []).filter(m => m.project_id === p.id),
      wait:st.filter(s => s.k === 'wait').length, chg:st.filter(s => s.k === 'change').length,
      brief:b && b.submitted ? b.submitted_at : null,
      quote:bill.filter(x => x.kind === 'quote' && x.accepted_at && Date.now() - Date.parse(x.accepted_at) < 14 * 864e5).length,
      late:bill.filter(x => x.kind === 'invoice' && x.status !== 'paid' && x.due && x.due < today()).length};
  });
  renderList();
}
function renderList() {
  const isPro = p => (p.data || {}).stage === 'prospect';
  const groups = {clients:LIST.filter(p => !p.archived && !isPro(p)), prospects:LIST.filter(p => !p.archived && isPro(p)), archived:LIST.filter(p => p.archived)};
  const rows = groups[lTab];
  let h = `<div class="eyebrow">Gestion · Coup de Com’</div><h1>Projets</h1><p class="note">Un projet par client ou par mission. Tes clients se connectent sur <b>${esc(PUBLIC_URL.replace(/^https?:\/\//, ''))}</b> avec leur adresse e-mail et ne voient que leurs projets, selon leur rôle. Un prospect ne voit que son questionnaire de découverte et tes devis.</p>`;
  h += `<div class="acts"><button class="btn primary" id="newP">Nouveau client</button><button class="btn" id="newPro">Nouveau prospect</button><button class="btn" data-imp="open">Importer depuis l’Atelier</button></div><div id="impBox">${impBox()}</div>`;
  h += `<div class="seg gtabs">${[['clients', 'Clients'], ['prospects', 'Prospects'], ['archived', 'Archivés']].map(([k, l]) => `<button data-lt="${k}" aria-pressed="${lTab === k}">${l} (${groups[k].length})</button>`).join('')}</div>`;
  if (!rows.length) h += `<p class="empty">${lTab === 'archived' ? 'Aucun projet archivé.' : lTab === 'prospects' ? 'Aucun prospect en cours. Après un premier appel, crée-lui un espace découverte.' : 'Aucun client pour l’instant.'}</p>`;
  else h += `<div class="plist">${rows.map(p => {
    const s = LSTAT[p.id] || {mem:[]}, d = p.data || {};
    const pills = [s.chg ? `<span class="pill red">${s.chg} modification${s.chg > 1 ? 's' : ''} à traiter</span>` : '', s.wait ? `<span class="pill wait">${s.wait} post${s.wait > 1 ? 's' : ''} chez le client</span>` : '', s.brief ? `<span class="pill ok">${d.stage === 'prospect' ? 'Questionnaire reçu' : 'Brief reçu'}</span>` : '', s.quote ? '<span class="pill ok">Devis accepté</span>' : '', s.late ? `<span class="pill red">${s.late} facture${s.late > 1 ? 's' : ''} en retard</span>` : ''].join('');
    return `<a class="card pcard" href="#p=${p.id}"><b>${esc(d.project || 'Projet sans nom')}</b><small>${esc(d.client || 'Client à renseigner')} · ${s.mem.length ? esc(s.mem.map(m => m.email).join(', ')) : '<span class="warn">aucun accès client</span>'}</small>${pills ? `<span class="pills">${pills}</span>` : ''}<small>Modifié le ${fdt(p.updated_at)}</small></a>`;
  }).join('')}</div>`;
  const a = AGENCY || {};
  h += `<h2>Coordonnées de paiement</h2><form class="card" id="fAg" novalidate><p class="note" style="margin-top:0">Affichées sous les factures à régler, uniquement pour les gérants et la compta de tes clients connectés.</p><div class="grid2">
    <label class="f">Titulaire du compte<input class="in" data-ag="holder" value="${esc(a.holder)}" placeholder="ex. Coup de Com’ · Prénom Nom"></label>
    <label class="f">IBAN<input class="in" data-ag="iban" value="${esc(a.iban)}" placeholder="FR76 …" autocomplete="off"></label>
    <label class="f">BIC<input class="in" data-ag="bic" value="${esc(a.bic)}"></label>
    <label class="f">Banque<input class="in" data-ag="bank" value="${esc(a.bank)}" placeholder="ex. Revolut"></label>
    <label class="f">Lien de paiement Revolut (facultatif)<input class="in" data-ag="revolut" value="${esc(a.revolut)}" placeholder="https://revolut.me/…"></label>
    <label class="f">Petite phrase (facultatif)<input class="in" data-ag="pay_note" value="${esc(a.pay_note)}" maxlength="200" placeholder="ex. Paiement à 30 jours, merci !"></label></div><p class="note" id="saveSt"></p></form>`;
  h += `<h2>Ton accès</h2><form class="card" id="fPw" novalidate><p class="note" style="margin-top:0">Définis un mot de passe pour te connecter sans attendre l’e-mail : sur la page de connexion, clique « J’ai un mot de passe ». Le lien par e-mail marche toujours.</p>
    <input type="email" autocomplete="username" value="${esc(email)}" hidden readonly>
    <div class="grid2"><label class="f">Nouveau mot de passe (10 caractères minimum)<input class="in" id="pw1" type="password" autocomplete="new-password" minlength="10"></label><label class="f">Le même, pour confirmer<input class="in" id="pw2" type="password" autocomplete="new-password"></label></div>
    <div class="acts"><button class="btn" type="submit">Enregistrer le mot de passe</button></div></form>`;
  app().innerHTML = h;
  app().onchange = null;
  app().oninput = e => {
    const k = e.target.dataset.ag; if (!k) return;
    AGENCY[k] = k === 'iban' || k === 'bic' ? e.target.value.toUpperCase() : e.target.value;
    later('agency', async () => { const {error} = await sb.from('agency').upsert({id:1, holder:AGENCY.holder || '', iban:AGENCY.iban || '', bic:AGENCY.bic || '', bank:AGENCY.bank || '', revolut:okUrl(AGENCY.revolut) ? AGENCY.revolut.trim() : '', pay_note:AGENCY.pay_note || ''}, {onConflict:'id'}); return !error; });
  };
  $('#fPw').onsubmit = async e => {
    e.preventDefault(); const a1 = $('#pw1').value, a2 = $('#pw2').value, btn = e.target.querySelector('button');
    if (a1.length < 10) { toast('10 caractères minimum'); return; }
    if (a1 !== a2) { toast('Les deux mots de passe ne sont pas identiques'); return; }
    btn.disabled = true; const {error} = await sb.auth.updateUser({password:a1}); btn.disabled = false;
    if (error) { toast(/reauth|recent/i.test(error.message) ? 'Par sécurité : déconnecte-toi, reconnecte-toi avec le lien e-mail, puis enregistre le mot de passe tout de suite' : /weak|pwned|easy|guess/i.test(error.message) ? 'Mot de passe trop simple : allonge-le ou mélange lettres, chiffres et symboles' : 'Enregistrement impossible : ' + error.message); return; }
    $('#pw1').value = $('#pw2').value = ''; toast('Mot de passe enregistré');
  };
  app().onclick = e => { if (impClick(e)) return; const b = e.target.closest('[data-lt]'); if (b) { lTab = b.dataset.lt; renderList(); } };
  impBind();
  const create = async (btn, stage) => {
    btn.disabled = true;
    const {data, error} = await sb.from('projects').insert({data:{...blank(), stage, project:stage === 'prospect' ? 'Découverte' : ''}}).select('id').single();
    btn.disabled = false;
    if (error) { toast('Création impossible : ' + error.message); return; }
    location.hash = 'p=' + data.id;
  };
  $('#newP').onclick = e => create(e.target, 'client');
  $('#newPro').onclick = e => create(e.target, 'prospect');
}

/* ---------- import depuis l'Atelier Coup de Com' (fiche copiée dans l'Atelier, collée ici) ---------- */
let IMP = null;
const IMP_ST = {'À faire':'todo', 'En cours':'doing', 'Fait':'done', todo:'todo', doing:'doing', done:'done'};
const normN = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clip = (s, n) => String(s ?? '').slice(0, n);
function impParse(text) {
  const i = text.indexOf('{'), j = text.lastIndexOf('}');
  if (i < 0 || j < i) throw new Error('Rien à lire : colle le texte copié depuis l’Atelier.');
  let o; try { o = JSON.parse(text.slice(i, j + 1)); } catch (e) { throw new Error('Le texte est incomplet : recopie-le depuis l’Atelier.'); }
  if (o.format === 'coupdecom-devis') return [impQuote(o)];
  if (o.format !== 'coupdecom-atelier' || !Array.isArray(o.items)) throw new Error('Ce texte ne vient pas de l’Atelier Coup de Com’.');
  return o.items.slice(0, 60).map(x => ({
    atelierId:clip(x.atelierId, 80), kind:x.kind === 'prospect' ? 'prospect' : 'client', name:clip(x.name, 120) || 'Sans nom',
    sector:clip(x.sector, 80), city:clip(x.city, 80), description:clip(x.description, 400), contactName:clip(x.contactName, 80),
    email:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x.email || '').trim()) ? String(x.email).trim().toLowerCase() : '',
    phone:clip(x.phone, 40), instagram:clip(x.instagram, 120), tiktok:clip(x.tiktok, 120), facebook:clip(x.facebook, 200), website:clip(x.website, 200),
    pack:clip(x.pack, 80), nextAction:clip(x.nextAction, 200), nextDate:/^\d{4}-\d{2}-\d{2}$/.test(x.nextDate || '') ? x.nextDate : '',
    tasks:(Array.isArray(x.tasks) ? x.tasks : []).slice(0, 40).map(t => ({id:'at-' + clip(t.id || uid(), 40), t:clip(t.t, 160), s:IMP_ST[t.s] || 'todo', d:/^\d{4}-\d{2}-\d{2}$/.test(t.d || '') ? t.d : ''})).filter(t => t.t)}));
}
function impQuote(o) {
  const num = n => Math.round((+n || 0) * 100) / 100, day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
  return {quote:true, atelierId:clip(o.atelierId, 80), projectId:clip(o.projectId, 40), name:clip(o.client, 120) || 'Sans nom', label:clip(o.label, 160) || 'Devis', number:clip(o.number, 40), amount:num(o.amount),
    issued:day(o.issued), due:day(o.validUntil), lines:(Array.isArray(o.lines) ? o.lines : []).slice(0, 40).map(l => ({label:clip(l.label, 160), qty:Math.max(1, Math.min(999, +l.qty || 1)), price:num(l.price), type:l.type === 'mois' ? 'mois' : 'unique'})).filter(l => l.label),
    extra:{months:Math.max(0, Math.min(60, +o.months || 0)), discount:Math.max(0, Math.min(100, +o.discount || 0)), vat:!!o.vat, notes:clip(o.notes, 1500)}};
}
function impMatch(it) {
  if (it.quote) return LIST.find(p => p.id === it.projectId) || LIST.find(p => it.atelierId && (p.data || {}).atelierId === it.atelierId) || LIST.find(p => !p.archived && normN((p.data || {}).client) === normN(it.name) && normN(it.name));
  return LIST.find(p => (p.data || {}).atelierId && p.data.atelierId === it.atelierId) || LIST.find(p => !p.archived && normN((p.data || {}).client) === normN(it.name) && normN(it.name));
}
function impBox() {
  if (!IMP) return '';
  if (!IMP.items) return `<div class="card imp"><h3 style="margin-top:0">Importer depuis l’Atelier</h3>
    <p class="note" style="margin-top:0">Dans l’Atelier, ouvre la fiche du client ou du prospect et touche <b>« Espace client »</b> (ou, pour un devis validé, <b>« Copier pour l’Espace client »</b>), puis <b>« Copier »</b>. Colle le texte ici, ou dépose le fichier .txt / .json si tu l’as enregistré.</p>
    <textarea class="in" id="impT" rows="6" placeholder="Colle ici le texte copié depuis l’Atelier"></textarea>
    <div class="impdrop" id="impD">Ou dépose un fichier ici · <button class="linkbtn" data-imp="file">choisir un fichier</button></div>
    ${IMP.err ? `<p class="note warn">${esc(IMP.err)}</p>` : ''}
    <div class="acts"><button class="btn primary" data-imp="read">Lire</button><button class="btn ghost" data-imp="close">Annuler</button></div></div>`;
  return `<div class="card imp"><h3 style="margin-top:0">${IMP.items.length} fiche${IMP.items.length > 1 ? 's' : ''} à importer</h3>
    <p class="note" style="margin-top:0">Vérifie puis importe. Une fiche déjà importée est mise à jour (nom, prochaine étape, avancement venu de l’Atelier) : ce que tu as ajouté ici à la main est gardé. Rien n’est envoyé au client : l’invitation reste à copier dans le projet.</p>
    <div class="implist">${IMP.items.map((it, i) => { const ex = impMatch(it); if (it.quote) return `<label class="improw"><input type="checkbox" data-imc="${i}" ${it.skip ? '' : 'checked'}>
      <span><b>Devis ${esc(it.number)} · ${esc(it.label)}</b><small>${eur(it.amount)} · ${it.lines.length} ligne${it.lines.length > 1 ? 's' : ''}${it.due ? ' · valable jusqu’au ' + fd(it.due) : ''}</small>
      <small>${ex ? `Pour <span class="pill ok">${esc((ex.data || {}).client || 'projet')}</span> : le client le verra dans « ${(ex.data || {}).stage === 'prospect' ? 'Notre proposition' : 'Devis et factures'} » et pourra l’accepter` : '<span class="pill wait">Aucun projet trouvé</span> : importe d’abord la fiche du client'}</small></span></label>`; return `<label class="improw"><input type="checkbox" data-imc="${i}" ${it.skip ? '' : 'checked'}>
      <span><b>${esc(it.name)}</b><small>${it.kind === 'prospect' ? 'Prospect · espace découverte' : 'Client signé'}${it.city ? ' · ' + esc(it.city) : ''} · ${ex ? `<span class="pill wait">mise à jour de « ${esc((ex.data || {}).project || (ex.data || {}).client || 'projet')} »</span>` : '<span class="pill ok">nouveau projet</span>'}</small>
      <small>${it.tasks.length ? it.tasks.length + ' étape' + (it.tasks.length > 1 ? 's' : '') + ' d’avancement · ' : ''}${it.nextAction ? 'Prochaine étape : ' + esc(it.nextAction) : 'Pas de prochaine étape'}</small>
      ${it.email ? `<small><input type="checkbox" data-ima="${i}" ${it.noAccess ? '' : 'checked'}> Donner l’accès à ${esc(it.email)} (gérant)</small>` : '<small class="warn">Pas d’e-mail : tu ajouteras l’accès dans le projet</small>'}</span></label>`; }).join('')}</div>
    <div class="acts"><button class="btn primary" data-imp="go">Importer</button><button class="btn ghost" data-imp="back">Recommencer</button></div></div>`;
}
function impBrief(it) {
  const links = [it.instagram && (/^https?:/i.test(it.instagram) ? it.instagram : 'instagram.com/' + it.instagram.replace(/^@/, '')), it.tiktok && (/^https?:/i.test(it.tiktok) ? it.tiktok : 'tiktok.com/@' + it.tiktok.replace(/^@/, '')), it.facebook, it.website].filter(Boolean).join('\n');
  return {etab:it.description || [it.sector, it.city].filter(Boolean).join(' · '), reseaux:links, pratique:[it.city, it.phone].filter(Boolean).join(' · ')};
}
async function impRun(btn) {
  const its = IMP.items.filter(x => !x.skip); if (!its.length) { toast('Coche au moins une fiche'); return; }
  btn.disabled = true; let ok = 0, fail = 0;
  for (const it of its) {
    try {
      if (it.quote) { const ex = impMatch(it); if (!ex) throw new Error('no project');
        const row = {project_id:ex.id, kind:'quote', label:it.label, number:it.number, amount:it.amount, issued:it.issued || null, due:it.due || null, lines:it.lines, extra:it.extra};
        const {data:old} = await sb.from('billing').select('id,accepted_at').eq('project_id', ex.id).eq('kind', 'quote').eq('number', it.number).maybeSingle();
        if (old && old.accepted_at) throw new Error('already accepted');
        const {error} = old ? await sb.from('billing').update(row).eq('id', old.id) : await sb.from('billing').insert(row); if (error) throw error;
        ok++; continue; }
      const ex = impMatch(it), nets = [it.instagram && 'instagram', it.facebook && 'facebook', it.tiktok && 'tiktok'].filter(Boolean);
      let id;
      if (ex) {
        const d = {...blank(), ...(ex.data || {})};
        d.client = it.name; d.atelierId = it.atelierId; d.atelierAt = new Date().toISOString();
        if (it.nextAction) { d.next = it.nextAction; d.nextDate = it.nextDate; }
        if (d.stage === 'prospect' && it.kind === 'client') d.stage = 'client';
        d.tasks = [...(d.tasks || []).filter(t => !String(t.id).startsWith('at-')), ...it.tasks];
        const {error} = await sb.from('projects').update({data:d}).eq('id', ex.id); if (error) throw error; id = ex.id;
      } else {
        const d = {...blank(), stage:it.kind, client:it.name, project:it.kind === 'prospect' ? 'Découverte' : (it.pack && it.pack !== '—' ? it.pack : 'Accompagnement'), next:it.nextAction, nextDate:it.nextDate, tasks:it.tasks, atelierId:it.atelierId, atelierAt:new Date().toISOString()};
        if (nets.length) d.nets = nets;
        const {data, error} = await sb.from('projects').insert({data:d}).select('id').single(); if (error) throw error; id = data.id;
      }
      if (it.email && !it.noAccess) await sb.from('members').upsert({project_id:id, email:it.email, name:it.contactName || '', role:'gerant'}, {onConflict:'project_id,email', ignoreDuplicates:true});
      const pre = impBrief(it), {data:br} = await sb.from('briefs').select('project_id,data,submitted').eq('project_id', id).maybeSingle();
      if (!br) await sb.from('briefs').insert({project_id:id, data:pre, submitted:false});
      else if (!br.submitted) { const bd = {...(br.data || {})}; let ch = false; for (const k in pre) if (pre[k] && !String(bd[k] || '').trim()) { bd[k] = pre[k]; ch = true; } if (ch) await sb.from('briefs').update({data:bd}).eq('project_id', id); }
      ok++;
    } catch (e) { fail++; console.warn(e); }
  }
  btn.disabled = false; IMP = null;
  toast(fail ? `${ok} importé${ok > 1 ? 's' : ''}, ${fail} en erreur : vérifie ta connexion` : `${ok} fiche${ok > 1 ? 's' : ''} importée${ok > 1 ? 's' : ''} depuis l’Atelier`);
  adminList();
}
function impBind() {
  const d = $('#impD'); if (!d) return;
  const readFile = async f => { if (!f) return; if (f.size > 2e6) { toast('Fichier trop lourd'); return; } $('#impT').value = await f.text(); };
  d.ondragover = e => { e.preventDefault(); d.classList.add('on'); }; d.ondragleave = () => d.classList.remove('on');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('on'); readFile(e.dataTransfer.files[0]); };
  d.querySelector('[data-imp="file"]').onclick = async e => { e.preventDefault(); const fs = await pick('.txt,.json,text/plain,application/json', false); if (fs && fs[0]) readFile(fs[0]); };
}
function impClick(e) {
  const c = e.target.closest('[data-imc],[data-ima]');
  if (c && IMP && IMP.items) { const i = +(c.dataset.imc ?? c.dataset.ima); if (c.dataset.imc !== undefined) IMP.items[i].skip = !c.checked; else IMP.items[i].noAccess = !c.checked; return true; }
  const b = e.target.closest('[data-imp]'); if (!b || b.dataset.imp === 'file') return !!b;
  const k = b.dataset.imp;
  if (k === 'open') IMP = {};
  if (k === 'close') IMP = null;
  if (k === 'back') IMP = {};
  if (k === 'read') { try { IMP = {items:impParse($('#impT').value)}; } catch (err) { IMP = {err:err.message}; } }
  if (k === 'go') { impRun(b); return true; }
  const box = $('#impBox'); if (box) { box.innerHTML = impBox(); impBind(); if (k === 'open') box.scrollIntoView({block:'nearest', behavior:reduced() ? 'auto' : 'smooth'}); }
  return true;
}

/* ---------- un projet ---------- */
async function openProject(id) {
  app().innerHTML = '<p class="note">Chargement…</p>';
  if (!await loadProject(id)) { app().innerHTML = '<p class="note">Projet introuvable. <a href="#">Retour aux projets</a></p>'; return; }
  mode = 'edit'; OPENED = null; RAM = null; CSV = null; renderAdmin();
}
const saveProject = () => later('project', async () => { const {error} = await sb.from('projects').update({data:D}).eq('id', P.id); if (error) toast('Enregistrement impossible pour le moment'); return !error; }, 800);
const toLocal = t => { if (!t) return ''; const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
const lockOpen = () => allPaid() || !!(DLV && !DLV.after_paid);

function invite(m) {
  if (prospect()) return `Bonjour${m.name ? ' ' + m.name : ''},\n\nMerci pour notre échange ! Pour ${T('vous', 'te')} préparer une proposition sur mesure, j’ai ouvert ${T('votre', 'ton')} espace découverte. ${T('Vous pouvez', 'Tu peux')} y présenter ${T('votre', 'ton')} établissement et ${T('vos', 'tes')} envies, par écrit ou par message vocal, et ajouter ${T('vos', 'tes')} photos, logos et documents.\n\n${PUBLIC_URL}\n\n${T('Connectez-vous avec cette adresse e-mail', 'Connecte-toi avec cette adresse e-mail')} : ${m.email}. ${T('Vous recevrez un lien de connexion, sans mot de passe à créer.', 'Tu recevras un lien de connexion, sans mot de passe à créer.')}\n\nÀ très vite,\n${SIGN}`;
  const what = m.role === 'compta' ? T('vos devis et factures', 'tes devis et factures') : m.role === 'equipe' ? 'les posts à valider, le calendrier et les rapports' : T('les posts à valider, le calendrier, les rapports et vos factures', 'les posts à valider, le calendrier, les rapports et tes factures');
  return `Bonjour${m.name ? ' ' + m.name : ''},\n\n${T('Votre espace client Coup de Com’ est prêt. Vous y trouverez', 'Ton espace client Coup de Com’ est prêt. Tu y trouveras')} ${what}.\n\n${PUBLIC_URL}\n\n${T('Connectez-vous avec cette adresse e-mail', 'Connecte-toi avec cette adresse e-mail')} : ${m.email}. ${T('Vous recevrez un lien de connexion, sans mot de passe à créer.', 'Tu recevras un lien de connexion, sans mot de passe à créer.')}\n\nÀ très vite,\n${SIGN}`;
}
/* envoi par e-mail : ouvre Gmail (compte de l'agence) ou la messagerie de l'ordinateur, message prêt, il reste à cliquer sur Envoyer */
const inviteSubject = () => prospect() ? T('Votre espace découverte Coup de Com’', 'Ton espace découverte Coup de Com’') : T('Votre espace client Coup de Com’ est prêt', 'Ton espace client Coup de Com’ est prêt');
function sendMail(how, to, subject, body) {
  const e = encodeURIComponent, list = to.filter(Boolean).join(',');
  if (how === 'mailto') { location.href = `mailto:${list}?subject=${e(subject)}&body=${e(body)}`; return; }
  const w = window.open(`https://mail.google.com/mail/?${AGENCY_MAIL ? 'authuser=' + e(AGENCY_MAIL) + '&' : ''}view=cm&fs=1&to=${e(list)}&su=${e(subject)}&body=${e(body)}`, '_blank', 'noopener');
  toast(w === null ? 'Ton navigateur a bloqué la fenêtre : autorise les fenêtres pour ce site, ou utilise « Autre messagerie »' : 'Gmail s’ouvre avec le message prêt : vérifie puis clique sur Envoyer');
}
function reminder() {
  const w = POSTS.filter(p => pstat(p).k === 'wait').sort((a, b) => deadline(a) - deadline(b)); if (!w.length) return '';
  const first = MEMBERS.find(m => m.role === 'gerant') || MEMBERS[0] || {};
  return `Bonjour${first.name ? ' ' + first.name : ''},\n\n${w.length > 1 ? `${w.length} posts attendent` : 'Un post attend'} ${T('votre', 'ta')} validation dans ${T('votre', 'ton')} espace Coup de Com’ :\n${w.map(p => `· ${p.title || FORMATS[p.format] || 'Post'} (publication ${fwhen(p.publish_at)}), réponse avant le ${fwhen(deadline(p))}`).join('\n')}\n\n${PUBLIC_URL}\n\nSans réponse dans le délai, ${w.length > 1 ? 'ils seront validés' : 'il sera validé'} automatiquement pour que ${T('votre', 'ton')} compte reste actif.\n\nÀ très vite,\n${SIGN}`;
}

function renderAdmin() {
  hdr();
  const a = app();
  let h = `<p class="adtop"><a href="#" class="note">← Tous les projets</a><span class="note" id="saveSt">Enregistré</span></p>`;
  h += `<div class="eyebrow">Gestion du projet</div><h1>${esc(D.project || 'Nouveau projet')}</h1><p class="note">Tout s’enregistre tout seul. Les brouillons restent invisibles pour le client tant que tu ne les envoies pas.</p>`;
  h += `<div class="acts"><button class="btn" id="preview">Voir ce que voit le client</button></div>`;
  if (prospect()) {
    const accepted = BILL.some(b => b.kind === 'quote' && b.accepted_at);
    h += `<div class="hint pro"><p style="margin:0 0 8px"><b>Prospect.</b> Il voit seulement son questionnaire de découverte${BILL.some(b => b.kind === 'quote') ? ' et tes devis' : ''}. ${accepted ? '<b>Un devis est accepté</b> : ' : 'Quand il signe : '}passe-le en client pour ouvrir tout son espace (posts, calendrier, rapports, factures). Ses réponses, ses fichiers et ses messages vocaux sont conservés.</p><button class="btn primary sm" id="signP">Passer en client signé</button></div>`;
    h += accessAdmin() + projectAdmin() + briefAdmin() + billingAdmin();
  } else h += accessAdmin() + projectAdmin() + postsAdmin() + reportsAdmin() + briefAdmin() + livrablesAdmin() + tasksAdmin() + billingAdmin();
  h += `<h2>Projet terminé ?</h2><div class="card"><p class="note" style="margin-top:0">Archiver cache le projet au client et le range dans tes archives. Tu peux le ressortir à tout moment.</p><div class="acts"><button class="btn sm" id="archP">${P.archived ? 'Désarchiver le projet' : 'Archiver le projet'}</button><button class="btn sm ghost" id="delP">Supprimer définitivement</button></div></div>`;
  a.innerHTML = h;
  a.onclick = adminClick; a.oninput = adminInput; a.onchange = adminChange;
  const pa = $('#postsA');
  if (pa) { pa.ondragover = e => { const r = e.target.closest('[data-pid]'); if (r && r.classList.contains('open')) { e.preventDefault(); r.classList.add('drop'); } }; pa.ondragleave = e => { const r = e.target.closest('[data-pid]'); if (r) r.classList.remove('drop'); }; pa.ondrop = e => { const r = e.target.closest('[data-pid]'); if (!r) return; e.preventDefault(); r.classList.remove('drop'); addMedia(POSTS.find(x => x.id === r.dataset.pid), [...e.dataTransfer.files]); }; }
}

/* accès client */
function accessAdmin() {
  let h = `<h2>Accès client <small>${MEMBERS.length} personne${MEMBERS.length > 1 ? 's' : ''}</small></h2><div class="card" id="memA">`;
  h += MEMBERS.length ? MEMBERS.map(m => `<div class="mrow" data-mem="${esc(m.email)}"><div><b>${esc(m.email)}</b><input class="in" data-mf="name" value="${esc(m.name)}" placeholder="Prénom (facultatif)" aria-label="Prénom"></div><select class="in" data-mf="role" aria-label="Rôle">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${m.role === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select><div class="acts" style="margin:0"><button class="btn sm primary" data-ma="gmail">Envoyer par Gmail</button><button class="btn sm" data-ma="mailto">Autre messagerie</button><button class="btn sm ghost" data-ma="inv">Copier l’invitation</button><button class="icon" data-ma="del" aria-label="Retirer l’accès de ${esc(m.email)}">×</button></div></div>`).join('') : '<p class="note warn" style="margin-top:0">Ajoute l’adresse de ton client pour qu’il voie ce projet.</p>';
  h += `<form class="mrow add" id="addMem" novalidate><div><input class="in" id="mEmail" type="email" placeholder="adresse@client.fr" aria-label="Adresse e-mail"><input class="in" id="mName" placeholder="Prénom (facultatif)" aria-label="Prénom"></div><select class="in" id="mRole" aria-label="Rôle">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select><button class="btn" type="submit">Ajouter</button></form>`;
  h += `<p class="note">${Object.values(ROLES).map(v => `<b>${v[0]}</b> : ${v[1]}`).join(' · ')}. « Envoyer par Gmail » ouvre le message prêt dans Gmail (il reste à cliquer sur Envoyer) ; « Copier l’invitation » pour WhatsApp. Ton client tape son adresse sur la page, reçoit un lien et arrive sur son projet.</p></div>`;
  return h;
}
/* infos du projet */
function projectAdmin() {
  return `<h2>Projet</h2><div class="card grid2">
    <label class="f">Client<input class="in" data-f="client" value="${esc(D.client)}" placeholder="ex. Le Jardin d’Hiver"></label>
    <label class="f">Nom du projet<input class="in" data-f="project" value="${esc(D.project)}" placeholder="ex. Réseaux sociaux · Pack Extra"></label>
    <label class="f" style="grid-column:1/-1">Message d’accueil<textarea class="in" data-f="intro" maxlength="400" placeholder="ex. Ravis de vous accompagner ! Voici où en est votre communication.">${esc(D.intro)}</textarea></label>
    <label class="f">Prochaine étape<input class="in" data-f="next" value="${esc(D.next)}" placeholder="ex. Validation des posts de décembre"></label>
    <label class="f">Date de la prochaine étape<input class="in" type="date" data-f="nextDate" value="${esc(D.nextDate)}"></label>
    <label class="f">Statut<select class="in" data-f="stage"><option value="prospect" ${prospect() ? 'selected' : ''}>Prospect (avant signature)</option><option value="client" ${prospect() ? '' : 'selected'}>Client signé</option></select></label>
    <label class="f">Ton avec ce client<select class="in" data-f="tone"><option value="vous" ${D.tone !== 'tu' ? 'selected' : ''}>Vouvoiement</option><option value="tu" ${D.tone === 'tu' ? 'selected' : ''}>Tutoiement</option></select></label>
    <label class="f">Contact affiché<input class="in" data-f="contact" value="${esc(D.contact)}" placeholder="ex. coupdecommunication@gmail.com · 07 …"></label>
    <label class="f">Délai de validation (heures)<input class="in" type="number" min="1" max="720" data-f="reviewHours" value="${+D.reviewHours || 48}"></label>
    <label class="f">Retouches incluses par post<input class="in" type="number" min="0" max="10" data-f="rounds" value="${+D.rounds || 0}"></label>
    <p class="note" style="grid-column:1/-1;margin:0">Le délai part du moment où tu envoies le post au client. Sans réponse à la fin du délai, le post est validé automatiquement (la base refuse ensuite les réponses). Un changement de délai s’applique aux prochains envois.</p></div>`;
}

/* posts */
function postsAdmin() {
  const all = POSTS.slice().sort((a, b) => (a.publish_at ? Date.parse(a.publish_at) : 9e15) - (b.publish_at ? Date.parse(b.publish_at) : 9e15));
  const todo = p => ['draft', 'wait', 'change'].includes(pstat(p).k);
  const tabs = [['todo', 'À traiter', all.filter(todo).length], ['all', 'Tous', all.length], ['pub', 'Publiés', all.filter(p => p.state === 'published').length]];
  const list = pFilter === 'todo' ? all.filter(todo) : pFilter === 'pub' ? all.filter(p => p.state === 'published') : all;
  const nW = all.filter(p => pstat(p).k === 'wait').length;
  let h = `<h2>Posts <small>${all.length} au total</small></h2><div class="card" id="postsA"><div class="acts" style="margin-top:0"><button class="btn primary" data-pa="new">Nouveau post</button><span class="seg">${tabs.map(t => `<button data-pft="${t[0]}" aria-pressed="${pFilter === t[0]}">${t[1]} (${t[2]})</button>`).join('')}</span>${nW ? `<button class="btn sm" data-pa="remindMail">Envoyer un rappel par Gmail (${nW} en attente)</button><button class="btn sm ghost" data-pa="remind">Copier le rappel</button>` : ''}</div>`;
  if (!list.length) h += `<p class="empty">${pFilter === 'todo' ? 'Rien à traiter. Crée le prochain post !' : 'Aucun post.'}</p>`;
  let month = '';
  list.forEach(p => {
    const m = p.publish_at ? new Date(p.publish_at).toLocaleDateString('fr-FR', {month:'long', year:'numeric'}) : 'Date à fixer';
    if (m !== month) { month = m; h += `<h3 class="h3">${esc(m)}</h3>`; }
    const st = pstat(p), open = OPENED === p.id;
    h += `<div class="prow${open ? ' open' : ''}" data-pid="${esc(p.id)}"><button class="psum" data-pa="toggle" aria-expanded="${open}"><span class="pth sm">${thumbOf(p)}</span><span class="pcb"><b>${esc(p.title || FORMATS[p.format] || 'Post')}</b><small>${esc(fwhen(p.publish_at))} · <span class="nets">${netTags(p.networks)}</span>${esc(FORMATS[p.format] || '')}${p.v > 1 ? ' · V' + p.v : ''}</small></span><span class="pill ${st.c}">${st.l}${st.k === 'wait' ? ' · ' + fleft(p) : ''}</span></button>${open ? postEditor(p, st) : ''}</div>`;
  });
  return h + `<p class="note">Glisse des images ou des vidéos sur un post ouvert pour les ajouter. Formats : JPEG, PNG, WebP, MP4, MOV (50 Mo max par fichier).</p></div>`;
}
function postEditor(p, st) {
  const last = lastRev(p), media = p.media || [];
  let h = `<div class="ped"><div class="grid2">
    <label class="f">Date et heure de publication<input class="in" type="datetime-local" data-pf="publish_at" value="${esc(toLocal(p.publish_at))}"></label>
    <label class="f">Format<select class="in" data-pf="format">${Object.entries(FORMATS).map(([k, v]) => `<option value="${k}" ${p.format === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f" style="grid-column:1/-1">Titre (affiché dans le calendrier)<input class="in" data-pf="title" value="${esc(p.title)}" maxlength="80" placeholder="ex. Brunch du dimanche"></label></div>
    <div class="f"><span>Réseaux</span><div class="chips">${Object.entries(NETS).map(([k, v]) => `<button type="button" data-pnet="${k}" aria-pressed="${(p.networks || []).includes(k)}">${v[0]}</button>`).join('')}</div></div>
    <label class="f">Légende <span class="note" data-cc>${(p.caption || '').length} caractères${(p.caption || '').length > 2200 ? ' : trop long pour Instagram (2 200 max)' : ''}</span><textarea class="in cap-in" data-pf="caption" rows="6" placeholder="Le texte du post, avec les hashtags">${esc(p.caption)}</textarea></label>
    <div class="f"><span>Visuels ${media.length ? `(${media.length})` : ''}</span>${media.length ? `<div class="mgrid">${media.map((m, i) => `<figure class="mth">${isVid(m) ? `<video src="${esc(fileUrl(m.file))}" muted playsinline preload="metadata"></video>` : `<span class="pw"><img src="${esc(fileUrl(m.file))}" alt="${esc(m.name || '')}">${last && last.decision === 'change' ? pinsHtml(last.pins, i) : ''}</span>`}<figcaption><button class="icon" data-pa="left" data-i="${i}" aria-label="Avancer" ${i ? '' : 'disabled'}>‹</button><button class="icon" data-pa="rm" data-i="${i}" aria-label="Retirer ce visuel">×</button></figcaption></figure>`).join('')}</div>` : ''}<div class="acts" style="margin:6px 0 0"><button class="btn sm" data-pa="add">Ajouter des visuels</button><span class="note" data-prog aria-live="polite"></span></div></div>
    <div class="grid2"><label class="f">Ou un lien (Canva, Drive…)<input class="in" data-pf="link" value="${esc(p.link)}" placeholder="https://…"></label>
    <label class="f">Ton mot pour le client (facultatif)<input class="in" data-pf="note" value="${esc(p.note)}" maxlength="300" placeholder="ex. On mise sur la photo de la terrasse"></label></div>`;
  if (last) h += `<p class="lbl" style="margin-top:14px">Réponse du client · version ${p.v}</p>${revSummary(last, true)}`;
  else if (st.k === 'auto') h += `<p class="note">Aucune réponse : validé automatiquement le ${fdt(deadline(p))}.</p>`;
  const older = (REV[p.id] || []).filter(r => r.v !== p.v);
  if (older.length) h += `<details><summary>Historique (${older.length})</summary>${older.slice().reverse().map(r => `<p class="note" style="margin:8px 0 4px">Version ${r.v}</p>${revSummary(r, true)}`).join('')}</details>`;
  h += '<div class="acts">';
  if (p.state === 'draft') h += `<button class="btn primary" data-pa="send">Envoyer au client pour validation</button><button class="btn sm ghost" data-pa="pub">Marquer publié sans validation</button>`;
  if (p.state === 'review') h += `${st.k === 'change' ? '<button class="btn primary" data-pa="newv">Envoyer la version corrigée</button>' : '<button class="btn sm" data-pa="newv">Envoyer une nouvelle version</button>'}<button class="btn sm${st.k === 'ok' || st.k === 'auto' ? ' primary' : ''}" data-pa="pub">Marquer publié</button><button class="btn sm ghost" data-pa="draft">Repasser en brouillon</button>`;
  if (p.state === 'published') h += `<button class="btn sm ghost" data-pa="unpub">Annuler « publié »</button>`;
  h += `<button class="btn sm ghost" data-pa="dup">Dupliquer</button><button class="btn sm ghost" data-pa="del">Supprimer</button></div>`;
  if (p.state === 'review' && st.k === 'wait') h += `<p class="note">Envoyé le ${fdt(p.sent_at)} · réponse attendue avant ${fdt(deadline(p))}. Après « Envoyer une nouvelle version », le délai repart de zéro.</p>`;
  return h + '</div>';
}
const POSTF = ['publish_at', 'networks', 'format', 'title', 'caption', 'media', 'link', 'note'];
function savePost(p) { later('post:' + p.id, async () => { const row = {}; POSTF.forEach(k => row[k] = p[k]); const {error} = await sb.from('posts').update(row).eq('id', p.id); if (error) toast('Post non enregistré : vérifie ta connexion'); return !error; }); }
async function setPost(p, fields, msg) {
  await flushAll();
  const {data, error} = await sb.from('posts').update(fields).eq('id', p.id).select().single();
  if (error || !data) { toast('Action impossible pour le moment'); return; }
  Object.assign(p, data); renderAdmin(); if (msg) toast(msg);
}
async function compress(f) {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size < 4 * 1024 * 1024) return f;
  try { const img = await loadImg(f); return new File([await toJpeg(img, 2560, .9)], f.name.replace(/\.\w+$/, '') + '.jpg', {type:'image/jpeg'}); } catch { return f; }
}
async function addMedia(p, files) {
  if (!p || !files.length) return;
  const row = document.querySelector(`[data-pid="${p.id}"] [data-prog]`);
  let ok = 0;
  for (const f0 of files) {
    if (!/^(image|video)\//.test(f0.type) && !/\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i.test(f0.name)) continue;
    const f = await compress(f0);
    if (f.size > MAX_FILE) { toast(`${f.name} : trop lourd (50 Mo max), mets plutôt un lien`); continue; }
    if (row) row.textContent = `Envoi de ${f.name}…`;
    try { const path = await upload(`${P.id}/m/${uid()}-${safeName(f.name)}`, f); p.media = [...(p.media || []), {file:path, name:f.name, type:f.type}]; ok++; }
    catch (e) { toast(`${f.name} : l’envoi n’a pas abouti`); }
  }
  await signFiles(p.media.map(m => m.file)); savePost(p); renderAdmin();
  if (ok) toast(`${ok} visuel${ok > 1 ? 's' : ''} ajouté${ok > 1 ? 's' : ''}`);
}

/* rapports */
function reportsAdmin() {
  const reps = D.reports.slice().sort((a, b) => String(b.month).localeCompare(String(a.month)));
  if (!RAM || !reps.find(r => r.id === RAM)) RAM = reps[0] ? reps[0].id : null;
  let h = `<h2>Rapports <small>${reps.length} mois</small></h2><div class="card" id="repA">`;
  h += `<div class="f" style="margin-top:0"><span>Réseaux suivis pour ce client</span><div class="chips">${Object.entries(NETS).map(([k, v]) => `<button type="button" data-rnet="${k}" aria-pressed="${D.nets.includes(k)}">${v[0]}</button>`).join('')}</div></div>`;
  h += `<div class="acts"><button class="btn" data-ra="add">Ajouter un mois</button><button class="btn" data-ra="csv">Importer un fichier CSV (Metricool…)</button></div>`;
  if (CSV) h += csvPanel();
  if (reps.length) {
    h += `<div class="seg gtabs">${reps.map(r => `<button data-rsel="${esc(r.id)}" aria-pressed="${r.id === RAM}">${esc(r.month ? fmonth(r.month) : 'Mois à choisir')}</button>`).join('')}</div>`;
    const r = reps.find(x => x.id === RAM);
    h += `<div class="ped" data-rid="${esc(r.id)}"><label class="f" style="max-width:260px">Mois<input class="in" type="month" data-rf="month" value="${esc(r.month)}"></label>`;
    D.nets.forEach(n => {
      const o = (r.nets || {})[n] || {};
      h += `<fieldset class="netf"><legend>${esc(NETS[n][0])}</legend><div class="mgrid2">${METRICS.map(([k, l, agg]) => `<label class="f">${l}${agg === 'last' ? ' <span class="note">(fin de mois)</span>' : ''}<input class="in" inputmode="decimal" data-rnv="${n}" data-rk="${k}" value="${esc(o[k] ?? '')}"></label>`).join('')}</div></fieldset>`;
    });
    if (!D.nets.length) h += '<p class="note">Choisis au moins un réseau ci-dessus.</p>';
    const top = r.top || [];
    h += `<p class="lbl" style="margin-top:14px">Les 3 posts qui ont le mieux marché (facultatif)</p>`;
    for (let i = 0; i < 3; i++) {
      const t = top[i] || {};
      h += `<div class="trow2" data-ti="${i}"><span class="rk">${i + 1}</span>${fileUrl(t.img) ? `<img src="${esc(fileUrl(t.img))}" alt="">` : ''}<input class="in" data-tk="title" value="${esc(t.title)}" placeholder="Titre du post"><select class="in" data-tk="net" aria-label="Réseau"><option value="">Réseau</option>${D.nets.map(n => `<option value="${n}" ${t.net === n ? 'selected' : ''}>${NETS[n][0]}</option>`).join('')}</select><input class="in" data-tk="stat" value="${esc(t.stat)}" placeholder="ex. 3 200 vues, 140 partages"><input class="in" data-tk="link" value="${esc(t.link)}" placeholder="Lien du post"><button class="btn sm" data-ra="img" data-i="${i}">${t.img ? 'Changer l’image' : 'Image'}</button></div>`;
    }
    h += `<label class="f">Ton commentaire du mois<textarea class="in" data-rf="comment" rows="4" maxlength="1500" placeholder="ex. Très bon mois grâce au reel du brunch. En décembre, on mise sur les menus de fêtes.">${esc(r.comment || '')}</textarea></label>`;
    h += `<div class="acts"><button class="btn sm ghost" data-ra="del">Supprimer ce mois</button></div></div>`;
  } else h += '<p class="empty">Aucun rapport pour l’instant.</p>';
  return h + '</div>';
}
/* import CSV : lecture, correspondance des colonnes, regroupement par mois */
function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const d = [';', ',', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function parseNum(s) {
  s = String(s ?? '').replace(/[\s  %]/g, ''); if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  const c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c >= 0 && p >= 0) s = c > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c >= 0) s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  else if (p >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const v = parseFloat(s); return isNaN(v) ? null : v;
}
function parseMonth(s) {
  s = String(s || '').trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/))) return `${m[1]}-${m[2].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) return `${m[1]}-${m[2]}`;
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))) { let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000; const mo = b > 12 ? a : b; return `${y}-${String(mo).padStart(2, '0')}`; }
  const t = Date.parse(s); if (!isNaN(t)) { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  return null;
}
const GUESS = {
  date:/^(date|fecha|jour|day|datum|period|période)/i,
  followers:/(follower|abonn|seguidor|fans|communaut|community|page likes|total.*(abonn|follow))/i,
  reach:/(reach|port[ée]e|alcance|couverture|accounts reached|comptes touch)/i,
  impressions:/(impression|vues|views|visualisation|plays|lectures)/i,
  interactions:/(interaction|engagement|interacc)/i,
  posts:/^(posts?|publications?|nb.*post|number of posts|nombre de pub)/i,
  visits:/(visit|visite|visita)/i,
  clicks:/(clic|click|website|site web|lien)/i};
function csvGuess(headers) {
  const map = {}; const used = new Set();
  const find = (k, extraNo) => headers.findIndex((h, i) => !used.has(i) && GUESS[k].test(h) && !(extraNo && extraNo.test(h)));
  const di = find('date'); map.date = di; if (di >= 0) used.add(di);
  METRICS.forEach(([k]) => { const i = find(k, k === 'followers' ? /(new|nouveau|gagn|gain|perdu|lost|unfollow|growth|croiss|diff)/i : k === 'interactions' ? /(rate|taux|%)/i : null); map[k] = i; if (i >= 0) used.add(i); });
  return map;
}
function csvPanel() {
  let h = `<div class="csv"><p class="lbl" style="margin-top:0">Importer un fichier CSV</p>`;
  if (!CSV.rows) {
    return h + `<p class="note">Dans Metricool : Analytique › choisis le réseau et la période › bouton d’export › CSV. Un fichier par réseau. Les autres outils marchent aussi tant qu’il y a une colonne par chiffre.</p><div class="grid2"><label class="f">Réseau concerné<select class="in" id="csvNet">${Object.entries(NETS).map(([k, v]) => `<option value="${k}" ${CSV.net === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label><div class="f"><span>Fichier</span><button class="btn" data-ra="csvfile">Choisir le fichier CSV</button></div></div><div class="acts"><button class="btn sm ghost" data-ra="csvx">Annuler</button></div></div>`;
  }
  const opt = sel => `<option value="-1">— ignorer —</option>` + CSV.headers.map((x, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${esc(x || 'Colonne ' + (i + 1))}</option>`).join('');
  h += `<p class="note">${esc(CSV.name)} · ${CSV.rows.length} lignes · réseau : <b>${esc(NETS[CSV.net][0])}</b>. Vérifie les correspondances (devinées automatiquement), puis importe.</p>`;
  h += `<div class="mgrid2"><label class="f">Colonne de date<select class="in" data-cm="date">${opt(CSV.map.date)}</select></label>`;
  if (CSV.map.date < 0) h += `<label class="f">Mois concerné<input class="in" type="month" data-cmm value="${esc(CSV.month || '')}"></label>`;
  h += METRICS.map(([k, l, agg]) => `<label class="f">${l} <span class="note">(${agg === 'last' ? 'dernière valeur du mois' : 'total du mois'})</span><select class="in" data-cm="${k}">${opt(CSV.map[k])}</select></label>`).join('') + '</div>';
  const res = csvAggregate();
  h += res.length ? `<p class="note">Résultat : ${res.map(r => `<b>${esc(fmonth(r.month))}</b> (${METRICS.filter(m => r.v[m[0]] != null).map(m => m[1].toLowerCase() + ' ' + num(r.v[m[0]])).join(', ') || 'rien'})`).join(' · ')}</p>` : `<p class="note warn">Aucun mois reconnu : choisis la colonne de date ou le mois concerné.</p>`;
  return h + `<div class="acts"><button class="btn primary" data-ra="csvgo" ${res.length ? '' : 'disabled'}>Importer ${res.length} mois</button><button class="btn sm ghost" data-ra="csvx">Annuler</button></div></div>`;
}
function csvAggregate() {
  if (!CSV || !CSV.rows) return [];
  const by = {};
  CSV.rows.forEach(r => {
    const mo = CSV.map.date >= 0 ? parseMonth(r[CSV.map.date]) : CSV.month; if (!mo) return;
    const ds = CSV.map.date >= 0 ? String(r[CSV.map.date]) : '';
    const o = by[mo] = by[mo] || {month:mo, v:{}, lastKey:''};
    METRICS.forEach(([k, , agg]) => {
      const i = CSV.map[k]; if (i == null || i < 0) return; const v = parseNum(r[i]); if (v == null) return;
      if (agg === 'last') { if (o.v[k] == null || ds >= (o['d_' + k] || '')) { o.v[k] = v; o['d_' + k] = ds; } }
      else o.v[k] = (o.v[k] || 0) + v;
    });
  });
  return Object.values(by).filter(o => Object.keys(o.v).length).sort((a, b) => a.month.localeCompare(b.month));
}

/* brief */
/* questionnaire -> Atelier (pour préparer le devis) */
function briefExport() {
  const d = BD(), ans = questions().filter(x => answered(d, x)).map(x => ({k:x.k, l:x.l, a:ansText(d, x), v:x.type === 'chips' ? (d[x.k] || []) : String(d[x.k] || '')}));
  return JSON.stringify({format:'coupdecom-espace', v:1, exportedAt:new Date().toISOString(), projectId:P.id, atelierId:D.atelierId || '', client:D.client || '', project:D.project || '', stage:D.stage || 'client',
    submittedAt:(BRIEF && BRIEF.submitted_at) || '', answers:ans, voiceCount:(d.voice || []).length, fileCount:(d.files || []).length}, null, 1);
}
function briefAdmin() {
  const d = BD();
  let h = prospect() ? `<h2>Questionnaire de découverte</h2><div class="card">` : `<h2>Brief de démarrage</h2><div class="card"><label class="chk" style="margin-top:0"><input type="checkbox" data-f="brief" ${D.brief !== false ? 'checked' : ''}> Proposer le questionnaire de démarrage au client</label>`;
  if (BRIEF && BRIEF.submitted) h += `<p${prospect() ? ' style="margin-top:0"' : ''}><span class="pill ok">Reçu le ${fdt(BRIEF.submitted_at)}</span>${BRIEF.updated_by ? ` <span class="note">par ${esc(BRIEF.updated_by)}</span>` : ''}</p>${briefAnswers(d)}<div class="acts"><button class="btn sm primary" data-ba2="toAtelier">Copier pour l’Atelier (devis)</button><button class="btn sm" data-ba2="reopen">Rouvrir au client</button></div>`;
  else if (BRIEF && Object.keys(d).length) h += `<p class="note">En cours de remplissage par le client (dernière modification le ${fdt(BRIEF.updated_at)}).</p><details><summary>Voir les réponses déjà saisies</summary>${briefAnswers(d)}<div class="acts"><button class="btn sm" data-ba2="toAtelier">Copier pour l’Atelier (devis)</button></div></details>`;
  else h += `<p class="note"${prospect() ? ' style="margin-top:0"' : ''}>${prospect() ? 'Le prospect n’a pas encore commencé. Ajoute son adresse dans « Accès client » et envoie-lui l’invitation.' : 'Le client n’a pas encore commencé.'}</p>`;
  return h + '</div>';
}

/* livrables + livraison */
function livrablesAdmin() {
  const op = lockOpen(), d = DLV || {link:'', msg:'', after_paid:true};
  let h = `<h2>Livrables et livraison</h2><div class="card" id="livA"><p class="note" style="margin-top:0">Pour chaque livrable (logo, charte, déclinaisons) : importe le fichier final. Si c’est une image, un aperçu avec le filigrane « Coup de Com’ · Aperçu » est créé tout seul. Pour un PDF, un ZIP ou un fichier Illustrator, ajoute une image d’aperçu.</p>`;
  h += `<p><span class="pill ${op ? 'ok' : 'wait'}" id="lockSt">${op ? 'Fichiers sources et lien ouverts au client' : 'Fichiers sources et lien verrouillés : factures à régler'}</span></p>`;
  h += D.livrables.map(x => `<div class="row" data-lid="${esc(x.id)}"><div class="lrow">${fileUrl(x.preview) ? `<img src="${esc(fileUrl(x.preview))}" alt="">` : '<span class="ph">?</span>'}<div class="grid2"><label class="f">Titre<input class="in" data-lf="title" value="${esc(x.title)}" placeholder="ex. Logo principal"></label><label class="f">Précision (facultatif)<input class="in" data-lf="note" value="${esc(x.note)}" placeholder="ex. PNG, SVG et PDF dans le ZIP"></label></div></div><div class="acts" style="margin:6px 0 0"><span class="note">${x.src ? (fileUrl(x.src) ? `<a href="${esc(fileUrl(x.src))}" target="_blank" rel="noopener">${esc(x.fname || 'Fichier')}</a>` : esc(x.fname || 'Fichier')) : 'Pas de fichier final'}</span><button class="btn sm" data-la="src">${x.src ? 'Remplacer le fichier' : 'Importer le fichier final'}</button><button class="btn sm" data-la="prev">Changer l’aperçu</button><button class="btn sm ghost" data-la="del">Supprimer</button></div></div>`).join('');
  h += `<div class="acts"><button class="btn" data-la="add">Ajouter un livrable</button><span class="note" id="livProg" aria-live="polite"></span></div>`;
  h += `<p class="lbl" style="margin-top:18px">Lien de livraison (facultatif)</p><label class="f">Lien de téléchargement (SwissTransfer, WeTransfer…)<input class="in" data-df="link" value="${esc(d.link)}" placeholder="https://www.swisstransfer.com/d/…"></label><label class="f">Texte du bouton<input class="in" data-db="1" value="${esc(D.dlvBtn || '')}" maxlength="40" placeholder="Télécharger mes fichiers"></label><label class="f">Ton mot (facultatif)<input class="in" data-df="msg" value="${esc(d.msg)}" maxlength="300" placeholder="ex. Voici tous les fichiers de votre identité visuelle"></label>`;
  h += `<label class="chk"><input type="checkbox" data-df="after_paid" ${d.after_paid ? 'checked' : ''}> Ouvrir les fichiers sources et le lien seulement quand toutes les factures sont payées</label><p class="note">C’est la base de données qui vérifie : tant qu’une facture est « À régler », le client voit les aperçus filigranés mais ne peut ni ouvrir le lien ni télécharger les fichiers sources. Le filigrane décourage la copie sans l’empêcher totalement (une capture d’écran reste possible), d’où l’aperçu en définition réduite.</p></div>`;
  return h;
}
async function loadImg(blob) {
  const u = URL.createObjectURL(blob), img = new Image(); img.src = u;
  try { await img.decode(); } finally { setTimeout(() => URL.revokeObjectURL(u), 2000); }
  return img;
}
async function toJpeg(img, max, q, mark) {
  let w = img.naturalWidth || 1200, h = img.naturalHeight || 1200; const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
  if (mark) {
    const fs = Math.max(14, Math.round(Math.min(w, h) / 15)), txt = 'COUP DE COM’ · APERÇU';
    x.save(); x.translate(w / 2, h / 2); x.rotate(-Math.PI / 7); x.font = `600 ${fs}px Outfit, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const tw = x.measureText(txt).width + fs * 2, lh = fs * 3, R = Math.hypot(w, h);
    for (let yy = -R, row = 0; yy < R; yy += lh, row++) for (let xx = -R - (row % 2) * tw / 2; xx < R; xx += tw) { x.fillStyle = 'rgba(255,255,255,.4)'; x.fillText(txt, xx + 1.5, yy + 1.5); x.fillStyle = 'rgba(47,74,58,.36)'; x.fillText(txt, xx, yy); }
    x.restore();
  }
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('jpeg')), 'image/jpeg', q));
}
async function makePreview(x, img) {
  const blob = await toJpeg(await loadImg(img), 1200, .8, true);
  const old = x.preview; x.preview = await upload(`${P.id}/apercu/${x.id}-${uid()}.jpg`, blob, 'image/jpeg');
  if (old) sb.storage.from('espace').remove([old]);
}
async function setSource(x, f) {
  if (f.size > MAX_FILE) { toast(`${f.name} : trop lourd (50 Mo max). Utilise plutôt le lien de livraison.`); return false; }
  const old = x.src; x.src = await upload(`${P.id}/src/${x.id}-${safeName(f.name)}`, f); x.fname = f.name;
  if (old) sb.storage.from('espace').remove([old]);
  if (isImg(f)) { try { await makePreview(x, f); } catch { toast('Aperçu impossible pour ce fichier : ajoute une image d’aperçu'); } }
  return true;
}

/* tâches */
const TPL = {
  com:['Brief et audit de départ', 'Ligne éditoriale et calendrier', 'Création des contenus du mois', 'Validation par le client', 'Publication et animation', 'Rapport du mois'],
  brand:['Brief et moodboard', 'Pistes de logo', 'Choix et ajustements', 'Charte graphique', 'Déclinaisons et livraison']};
function tasksAdmin() {
  return `<h2>Avancement</h2><div class="card">${D.tasks.map((t, i) => `<div class="row" data-tid="${esc(t.id)}"><div class="trow"><input class="in" data-tf="t" value="${esc(t.t)}" placeholder="ex. Création des contenus" aria-label="Tâche"><select class="in" data-tf="s" aria-label="Statut"><option value="todo" ${t.s === 'todo' ? 'selected' : ''}>À venir</option><option value="doing" ${t.s === 'doing' ? 'selected' : ''}>En cours</option><option value="done" ${t.s === 'done' ? 'selected' : ''}>Terminé</option></select><input class="in" type="date" data-tf="d" value="${esc(t.d)}" aria-label="Date"><span class="acts" style="margin:0"><button class="icon" data-ta="up" aria-label="Monter" ${i ? '' : 'disabled'}>↑</button><button class="icon" data-ta="del" aria-label="Supprimer la tâche">×</button></span></div></div>`).join('') || '<p class="empty">Aucune étape.</p>'}
    <div class="acts"><button class="btn" data-ta="add">Ajouter une étape</button><button class="btn sm ghost" data-ta="com">Étapes types : réseaux sociaux</button><button class="btn sm ghost" data-ta="brand">Étapes types : branding</button></div></div>`;
}

/* devis et factures */
const BILLF = ['kind', 'label', 'number', 'amount', 'issued', 'due', 'status', 'file', 'fname'];
function billingAdmin() {
  let h = `<h2>Devis et factures</h2><div class="card">`;
  h += BILL.map(b => `<div class="row" data-bid="${esc(b.id)}"><div class="grid2">
    <label class="f">Type<select class="in" data-bf="kind"><option value="quote" ${b.kind === 'quote' ? 'selected' : ''}>Devis</option><option value="invoice" ${b.kind === 'invoice' ? 'selected' : ''}>Facture</option></select></label>
    <label class="f">Intitulé<input class="in" data-bf="label" value="${esc(b.label)}" placeholder="${b.kind === 'quote' ? 'ex. Pack Extra · 3 mois' : 'ex. Novembre 2026'}"></label>
    <label class="f">Numéro<input class="in" data-bf="number" value="${esc(b.number)}" placeholder="ex. 2026-014"></label>
    <label class="f">Montant (€)<input class="in" type="number" step="0.01" min="0" data-bf="amount" value="${esc(b.amount)}"></label>
    <label class="f">Date<input class="in" type="date" data-bf="issued" value="${esc(b.issued || '')}"></label>
    ${b.kind === 'invoice' ? `<label class="f">Échéance<input class="in" type="date" data-bf="due" value="${esc(b.due || '')}"></label><label class="f">Statut<select class="in" data-bf="status"><option value="due" ${b.status !== 'paid' ? 'selected' : ''}>À régler</option><option value="paid" ${b.status === 'paid' ? 'selected' : ''}>Payée</option></select></label>` : `<div class="f"><span>Acceptation</span>${b.accepted_at ? `<span class="pill ok">Accepté le ${fdt(b.accepted_at)}${b.accepted_by ? ' par ' + esc(b.accepted_by) : ''}</span>` : '<span class="pill wait">En attente du gérant</span>'}</div>`}
    <div class="f"><span>PDF</span><span class="acts" style="margin:0"><button class="btn sm" data-ba="up">${b.file ? 'Remplacer le PDF' : 'Importer le PDF'}</button>${b.file ? `<span class="note">${esc(b.fname || 'PDF importé')}</span>` : ''}</span></div></div>
    <div class="acts">${b.kind === 'quote' && b.accepted_at ? '<button class="btn sm ghost" data-ba="unacc">Annuler l’acceptation</button>' : ''}<button class="btn sm ghost" data-ba="del">Supprimer</button></div></div>`).join('') || '<p class="empty">Aucun devis ni facture.</p>';
  return h + `<div class="acts"><button class="btn" data-ba="addq">Ajouter un devis</button><button class="btn" data-ba="addi">Ajouter une facture</button></div><p class="note">Le gérant accepte un devis d’un clic : la base enregistre la date et son adresse e-mail. Le gérant et la compta voient les factures et tes coordonnées de paiement ; l’équipe ne voit rien de financier.</p></div>`;
}
function saveBill(b) { later('bill:' + b.id, async () => { const row = {}; BILLF.forEach(k => row[k] = b[k] === '' && ['issued', 'due'].includes(k) ? null : b[k]); row.amount = +b.amount || 0; const {error} = await sb.from('billing').update(row).eq('id', b.id); if (error) toast('Document non enregistré : vérifie ta connexion'); return !error; }); }
function refreshLock() { const el = $('#lockSt'); if (!el) return; const op = lockOpen(); el.textContent = op ? 'Fichiers sources et lien ouverts au client' : 'Fichiers sources et lien verrouillés : factures à régler'; el.className = 'pill ' + (op ? 'ok' : 'wait'); }
const saveDlv = () => later('dlv', async () => { const {error} = await sb.from('deliveries').upsert({project_id:P.id, link:(DLV.link || '').trim(), msg:DLV.msg || '', after_paid:!!DLV.after_paid}, {onConflict:'project_id'}); return !error; });

/* ---------- événements de la vue gestion ---------- */
function adminInput(e) {
  const t = e.target;
  if (t.dataset.f) { const k = t.dataset.f; if (t.type === 'checkbox') return; D[k] = ['rounds', 'reviewHours'].includes(k) ? Math.max(k === 'reviewHours' ? 1 : 0, Math.min(k === 'reviewHours' ? 720 : 10, +t.value || 0)) : t.value; if (k === 'client') hdr(); saveProject(); return; }
  const pr = t.closest('[data-pid]');
  if (pr && t.dataset.pf) {
    const p = POSTS.find(x => x.id === pr.dataset.pid), k = t.dataset.pf;
    p[k] = k === 'publish_at' ? (t.value ? new Date(t.value).toISOString() : null) : t.value;
    if (k === 'caption') { const cc = pr.querySelector('[data-cc]'); if (cc) cc.textContent = `${t.value.length} caractères${t.value.length > 2200 ? ' : trop long pour Instagram (2 200 max)' : ''}`; }
    savePost(p); return;
  }
  const rr = t.closest('[data-rid]');
  if (rr) {
    const r = D.reports.find(x => x.id === rr.dataset.rid);
    if (t.dataset.rnv) { r.nets = r.nets || {}; const o = r.nets[t.dataset.rnv] = r.nets[t.dataset.rnv] || {}; const v = parseNum(t.value); o[t.dataset.rk] = v == null ? '' : v; }
    else if (t.dataset.rf === 'comment') r.comment = t.value;
    else if (t.dataset.tk) { const i = +t.closest('[data-ti]').dataset.ti; r.top = r.top || []; while (r.top.length <= i) r.top.push({}); r.top[i][t.dataset.tk] = t.value; }
    else return;
    saveProject(); return;
  }
  const lr = t.closest('[data-lid]');
  if (lr && t.dataset.lf) { D.livrables.find(x => x.id === lr.dataset.lid)[t.dataset.lf] = t.value; saveProject(); return; }
  if (t.dataset.db) { D.dlvBtn = t.value; saveProject(); return; }
  if (t.dataset.df && t.type !== 'checkbox') { DLV = {link:'', msg:'', after_paid:true, ...(DLV || {})}; DLV[t.dataset.df] = t.value; saveDlv(); return; }
  const tr = t.closest('[data-tid]');
  if (tr && t.dataset.tf) { D.tasks.find(x => x.id === tr.dataset.tid)[t.dataset.tf] = t.value; saveProject(); return; }
  const br = t.closest('[data-bid]');
  if (br && t.dataset.bf && t.tagName !== 'SELECT') { const b = BILL.find(x => x.id === br.dataset.bid); b[t.dataset.bf] = t.dataset.bf === 'amount' ? +t.value : t.value; saveBill(b); return; }
  const mr = t.closest('[data-mem]');
  if (mr && t.dataset.mf === 'name') { const m = MEMBERS.find(x => x.email === mr.dataset.mem); m.name = t.value; later('mem:' + m.email, async () => { const {error} = await sb.from('members').update({name:m.name}).eq('project_id', P.id).eq('email', m.email); return !error; }); }
}
async function adminChange(e) {
  const t = e.target;
  if (t.dataset.f === 'brief') { D.brief = t.checked; saveProject(); return; }
  if (t.dataset.f === 'tone') { D.tone = t.value; saveProject(); return; }
  if (t.dataset.f === 'stage') { if (t.value === 'client' && prospect()) { const b = $('#signP'); if (b) { t.value = 'prospect'; D.stage = 'prospect'; b.dataset.sure = 1; b.click(); return; } } D.stage = t.value; saveProject(); renderAdmin(); return; }
  if (t.dataset.df === 'after_paid') { DLV = {link:'', msg:'', after_paid:true, ...(DLV || {})}; DLV.after_paid = t.checked; saveDlv(); refreshLock(); return; }
  if (t.dataset.rf === 'month') { const r = D.reports.find(x => x.id === t.closest('[data-rid]').dataset.rid); if (D.reports.some(x => x !== r && x.month === t.value)) { toast('Ce mois existe déjà'); t.value = r.month; return; } r.month = t.value; saveProject(); renderAdmin(); return; }
  if (t.dataset.tk === 'net') { const r = D.reports.find(x => x.id === t.closest('[data-rid]').dataset.rid), i = +t.closest('[data-ti]').dataset.ti; r.top = r.top || []; while (r.top.length <= i) r.top.push({}); r.top[i].net = t.value; saveProject(); return; }
  if (t.dataset.cm) { CSV.map[t.dataset.cm] = +t.value; renderAdmin(); return; }
  if (t.hasAttribute('data-cmm')) { CSV.month = t.value; renderAdmin(); return; }
  if (t.id === 'csvNet') { CSV.net = t.value; return; }
  const br = t.closest('[data-bid]');
  if (br && t.dataset.bf && t.tagName === 'SELECT') { const b = BILL.find(x => x.id === br.dataset.bid); b[t.dataset.bf] = t.value; if (t.dataset.bf === 'status' || t.dataset.bf === 'kind') { saveBill(b); await flushAll(); renderAdmin(); } else saveBill(b); return; }
  const mr = t.closest('[data-mem]');
  if (mr && t.dataset.mf === 'role') { const m = MEMBERS.find(x => x.email === mr.dataset.mem); m.role = t.value; const {error} = await sb.from('members').update({role:m.role}).eq('project_id', P.id).eq('email', m.email); toast(error ? 'Rôle non enregistré' : `${m.email} : ${ROLES[m.role][0]}`); }
}
async function adminClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'preview') { await flushAll(); mode = 'view'; DRAFT = {}; viewRole = 'gerant'; OPEN = lockOpen(); renderClient(); scrollTo(0, 0); return; }
  if (b.id === 'signP') { confirmBtn(b, async () => {
    D.stage = 'client'; if (/^découverte$/i.test(D.project || '')) D.project = '';
    saveProject(); await flushAll();
    let msg = 'Client signé : tout son espace est ouvert';
    if (BRIEF && BRIEF.submitted && D.brief !== false) { const {data} = await sb.from('briefs').update({submitted:false}).eq('project_id', P.id).select().single(); if (data) { BRIEF = data; msg += ' · son brief est rouvert pour compléter les infos de démarrage'; } }
    renderAdmin(); scrollTo(0, 0); toast(msg);
  }, 'Confirmer : client signé'); return; }
  if (b.id === 'archP') { const {error} = await sb.from('projects').update({archived:!P.archived}).eq('id', P.id); if (error) { toast('Impossible pour le moment'); return; } P.archived = !P.archived; toast(P.archived ? 'Projet archivé : le client ne le voit plus' : 'Projet ressorti des archives'); renderAdmin(); return; }
  if (b.id === 'delP') { confirmBtn(b, async () => {
    const files = [...POSTS.flatMap(p => (p.media || []).map(m => m.file)), ...BILL.map(x => x.file), ...D.livrables.flatMap(x => [x.src, x.preview]), ...D.reports.flatMap(r => (r.top || []).map(t => t.img)), ...([...(BD().files || []), ...(BD().voice || [])].map(f => f.path))].filter(Boolean);
    for (let i = 0; i < files.length; i += 200) await sb.storage.from('espace').remove(files.slice(i, i + 200));
    Object.keys(Q).forEach(k => { clearTimeout(Q[k].t); delete Q[k]; });
    const {error} = await sb.from('projects').delete().eq('id', P.id);
    if (error) { toast('Suppression impossible'); return; }
    toast('Projet supprimé'); location.hash = '';
  }, 'Tout supprimer ?'); return; }

  /* accès */
  const mr = b.closest('[data-mem]');
  if (mr && b.dataset.ma) {
    const m = MEMBERS.find(x => x.email === mr.dataset.mem);
    if (b.dataset.ma === 'inv') copy(invite(m), 'Invitation copiée : colle-la dans WhatsApp ou un e-mail');
    if (b.dataset.ma === 'gmail' || b.dataset.ma === 'mailto') sendMail(b.dataset.ma, [m.email], inviteSubject(), invite(m));
    if (b.dataset.ma === 'del') confirmBtn(b, async () => { const {error} = await sb.from('members').delete().eq('project_id', P.id).eq('email', m.email); if (error) { toast('Impossible pour le moment'); return; } MEMBERS = MEMBERS.filter(x => x !== m); renderAdmin(); toast('Accès retiré'); }, 'Retirer ?');
    return;
  }
  if (b.closest('#addMem')) {
    e.preventDefault();
    const em = $('#mEmail').value.trim().toLowerCase(), name = $('#mName').value.trim(), rl = $('#mRole').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { toast('Vérifie l’adresse e-mail'); return; }
    if (MEMBERS.some(m => m.email === em)) { toast('Cette adresse a déjà accès'); return; }
    if (ADMINS.includes(em)) { toast('C’est une adresse admin : elle voit déjà tout'); return; }
    const {data, error} = await sb.from('members').insert({project_id:P.id, email:em, name, role:rl}).select().single();
    if (error) { toast('Ajout impossible : ' + error.message); return; }
    MEMBERS.push(data); renderAdmin(); toast(`${em} ajouté : copie l’invitation`);
    return;
  }

  /* posts */
  if (b.dataset.pft) { pFilter = b.dataset.pft; renderAdmin(); return; }
  if (b.dataset.pa === 'new') {
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(12, 0, 0, 0);
    const {data, error} = await sb.from('posts').insert({project_id:P.id, publish_at:d.toISOString(), networks:D.nets.filter(n => ['instagram', 'facebook'].includes(n)), format:'post', review_hours:+D.reviewHours || 48}).select().single();
    if (error) { toast('Création impossible : ' + error.message); return; }
    POSTS.push(data); OPENED = data.id; pFilter = pFilter === 'pub' ? 'todo' : pFilter; renderAdmin();
    const r = document.querySelector(`[data-pid="${data.id}"]`); if (r) { r.scrollIntoView({block:'start', behavior:reduced() ? 'auto' : 'smooth'}); const i = r.querySelector('[data-pf="title"]'); if (i) i.focus({preventScroll:true}); }
    return;
  }
  if (b.dataset.pa === 'remind') { copy(reminder(), 'Rappel copié : colle-le dans WhatsApp ou un e-mail'); return; }
  if (b.dataset.pa === 'remindMail') { const to = MEMBERS.filter(x => x.role !== 'compta').map(x => x.email); if (!to.length) { toast('Ajoute d’abord l’adresse de ton client dans « Accès client »'); return; } sendMail('gmail', to, T('Des posts attendent votre validation', 'Des posts attendent ta validation') + ' · Coup de Com’', reminder()); return; }
  const pr = b.closest('[data-pid]');
  if (pr) {
    const p = POSTS.find(x => x.id === pr.dataset.pid), k = b.dataset.pa;
    if (b.dataset.pnet) { const n = b.dataset.pnet, s = new Set(p.networks || []); s.has(n) ? s.delete(n) : s.add(n); p.networks = Object.keys(NETS).filter(x => s.has(x)); b.setAttribute('aria-pressed', s.has(n)); savePost(p); return; }
    if (k === 'toggle') { await flushAll(); OPENED = OPENED === p.id ? null : p.id; renderAdmin(); const r = document.querySelector(`[data-pid="${p.id}"]`); if (r && OPENED) r.scrollIntoView({block:'nearest'}); return; }
    if (k === 'add') { addMedia(p, await pick('image/*,video/*', true)); return; }
    if (k === 'rm') { const m = p.media[+b.dataset.i]; p.media = p.media.filter((x, i) => i !== +b.dataset.i); if (m && m.file && !POSTS.some(x => x !== p && (x.media || []).some(y => y.file === m.file))) sb.storage.from('espace').remove([m.file]); savePost(p); renderAdmin(); return; }
    if (k === 'left') { const i = +b.dataset.i, a = p.media.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; p.media = a; savePost(p); renderAdmin(); return; }
    if (k === 'send') { if (!(p.media || []).length && !okUrl(p.link) && !p.caption) { toast('Ajoute au moins un visuel, un lien ou une légende'); return; } await setPost(p, {state:'review', review_hours:+D.reviewHours || 48}, `Envoyé : le client a ${+D.reviewHours || 48} h pour répondre`); return; }
    if (k === 'newv') { await setPost(p, {v:(p.v || 1) + 1, state:'review', review_hours:+D.reviewHours || 48}, `Version ${(p.v || 1) + 1} envoyée : le délai repart de zéro`); return; }
    if (k === 'pub') { await setPost(p, {state:'published'}, 'Marqué publié'); return; }
    if (k === 'unpub' || k === 'draft') { await setPost(p, {state:'draft'}, 'Repassé en brouillon : invisible pour le client'); return; }
    if (k === 'dup') { const row = {project_id:P.id, review_hours:+D.reviewHours || 48}; POSTF.forEach(f => row[f] = p[f]); row.title = (p.title || 'Post') + ' (copie)'; const {data, error} = await sb.from('posts').insert(row).select().single(); if (error) { toast('Impossible pour le moment'); return; } POSTS.push(data); OPENED = data.id; renderAdmin(); toast('Post dupliqué en brouillon'); return; }
    if (k === 'del') { confirmBtn(b, async () => { Object.keys(Q).filter(x => x === 'post:' + p.id).forEach(x => { clearTimeout(Q[x].t); delete Q[x]; }); const {error} = await sb.from('posts').delete().eq('id', p.id); if (error) { toast('Suppression impossible'); return; } const files = (p.media || []).map(m => m.file).filter(f => f && !POSTS.some(x => x !== p && (x.media || []).some(y => y.file === f))); if (files.length) sb.storage.from('espace').remove(files); POSTS = POSTS.filter(x => x !== p); renderAdmin(); toast('Post supprimé'); }); return; }
    return;
  }

  /* rapports */
  if (b.dataset.rnet) { const n = b.dataset.rnet; D.nets = D.nets.includes(n) ? D.nets.filter(x => x !== n) : Object.keys(NETS).filter(x => x === n || D.nets.includes(x)); saveProject(); renderAdmin(); return; }
  if (b.dataset.rsel) { RAM = b.dataset.rsel; renderAdmin(); return; }
  if (b.dataset.ra === 'add') {
    const reps = repsSorted(), lastM = reps.length ? reps[reps.length - 1].month : null;
    let m; if (lastM) { const d = new Date(lastM + '-15T12:00'); d.setMonth(d.getMonth() + 1); m = d.toISOString().slice(0, 7); } else { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); m = d.toISOString().slice(0, 7); }
    const r = {id:uid(), month:m, nets:{}, top:[], comment:''}; D.reports.push(r); RAM = r.id; saveProject(); renderAdmin(); return;
  }
  if (b.dataset.ra === 'del') { confirmBtn(b, () => { const r = D.reports.find(x => x.id === RAM); (r.top || []).forEach(t => { if (t.img) sb.storage.from('espace').remove([t.img]); }); D.reports = D.reports.filter(x => x !== r); RAM = null; saveProject(); renderAdmin(); }); return; }
  if (b.dataset.ra === 'img') {
    const [f] = await pick('image/*'); if (!f) return;
    const r = D.reports.find(x => x.id === RAM), i = +b.dataset.i; r.top = r.top || []; while (r.top.length <= i) r.top.push({});
    try { const blob = await toJpeg(await loadImg(f), 800, .82); const old = r.top[i].img; r.top[i].img = await upload(`${P.id}/rap/${uid()}.jpg`, blob, 'image/jpeg'); if (old) sb.storage.from('espace').remove([old]); await signFiles([r.top[i].img]); saveProject(); renderAdmin(); }
    catch { toast('Image non importée'); }
    return;
  }
  if (b.dataset.ra === 'csv') { CSV = {net:D.nets[0] || 'instagram'}; renderAdmin(); return; }
  if (b.dataset.ra === 'csvx') { CSV = null; renderAdmin(); return; }
  if (b.dataset.ra === 'csvfile') {
    const net = ($('#csvNet') || {}).value || CSV.net; const [f] = await pick('.csv,text/csv,text/plain'); if (!f) return;
    const rows = parseCSV(await f.text()); if (rows.length < 2) { toast('Fichier vide ou illisible'); return; }
    const hi = rows.findIndex(r => r.filter(c => c.trim()).length >= 2);
    const headers = rows[hi].map(c => c.trim());
    CSV = {net, name:f.name, headers, rows:rows.slice(hi + 1), map:csvGuess(headers), month:''};
    renderAdmin(); return;
  }
  if (b.dataset.ra === 'csvgo') {
    const res = csvAggregate(); if (!D.nets.includes(CSV.net)) D.nets = Object.keys(NETS).filter(x => x === CSV.net || D.nets.includes(x));
    res.forEach(o => { let r = D.reports.find(x => x.month === o.month); if (!r) { r = {id:uid(), month:o.month, nets:{}, top:[], comment:''}; D.reports.push(r); } r.nets = r.nets || {}; r.nets[CSV.net] = {...(r.nets[CSV.net] || {}), ...o.v}; });
    const last = res[res.length - 1]; RAM = (D.reports.find(x => x.month === last.month) || {}).id; toast(`${res.length} mois importé${res.length > 1 ? 's' : ''} pour ${NETS[CSV.net][0]}`); CSV = null; saveProject(); renderAdmin(); return;
  }

  /* brief */
  if (b.dataset.ba2 === 'toAtelier') { copy(briefExport(), 'Copié : dans l’Atelier, touche « Importer de l’Espace client » et colle'); return; }
  if (b.dataset.ba2 === 'reopen') { const {data, error} = await sb.from('briefs').update({submitted:false}).eq('project_id', P.id).select().single(); if (error) { toast('Impossible pour le moment'); return; } BRIEF = data; renderAdmin(); toast('Brief rouvert : le client peut le modifier et le renvoyer'); return; }

  /* livrables */
  if (b.dataset.la === 'add') {
    const files = await pick('*/*', true); if (!files.length) return;
    const pg = $('#livProg');
    for (const f of files) {
      const x = {id:uid(), title:f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), note:'', src:'', fname:'', preview:''};
      if (pg) pg.textContent = `Import de ${f.name}…`;
      try { if (await setSource(x, f)) D.livrables.push(x); } catch { toast(`${f.name} : import impossible`); }
    }
    await signFiles(projectFiles()); saveProject(); renderAdmin(); return;
  }
  const lr = b.closest('[data-lid]');
  if (lr && b.dataset.la) {
    const x = D.livrables.find(y => y.id === lr.dataset.lid);
    if (b.dataset.la === 'src') { const [f] = await pick('*/*'); if (!f) return; try { await setSource(x, f); } catch { toast('Import impossible'); return; } await signFiles([x.src, x.preview]); saveProject(); renderAdmin(); toast('Fichier importé'); }
    if (b.dataset.la === 'prev') { const [f] = await pick('image/*'); if (!f) return; try { await makePreview(x, f); } catch { toast('Image illisible'); return; } await signFiles([x.preview]); saveProject(); renderAdmin(); toast('Aperçu filigrané créé'); }
    if (b.dataset.la === 'del') confirmBtn(b, () => { sb.storage.from('espace').remove([x.src, x.preview].filter(Boolean)); D.livrables = D.livrables.filter(y => y !== x); saveProject(); renderAdmin(); });
    return;
  }

  /* tâches */
  if (b.dataset.ta === 'add') { D.tasks.push({id:uid(), t:'', s:'todo', d:''}); saveProject(); renderAdmin(); return; }
  if (b.dataset.ta === 'com' || b.dataset.ta === 'brand') { TPL[b.dataset.ta].forEach(t => D.tasks.push({id:uid(), t, s:'todo', d:''})); saveProject(); renderAdmin(); return; }
  const tr = b.closest('[data-tid]');
  if (tr) { const i = D.tasks.findIndex(x => x.id === tr.dataset.tid); if (b.dataset.ta === 'del') D.tasks.splice(i, 1); else if (b.dataset.ta === 'up' && i > 0) [D.tasks[i - 1], D.tasks[i]] = [D.tasks[i], D.tasks[i - 1]]; saveProject(); renderAdmin(); return; }

  /* devis et factures */
  if (b.dataset.ba === 'addq' || b.dataset.ba === 'addi') {
    const kind = b.dataset.ba === 'addq' ? 'quote' : 'invoice';
    const {data, error} = await sb.from('billing').insert({project_id:P.id, kind, issued:today(), status:'due'}).select().single();
    if (error) { toast('Création impossible : ' + error.message); return; }
    BILL.push(data); renderAdmin(); refreshLock(); return;
  }
  const brw = b.closest('[data-bid]');
  if (brw && b.dataset.ba) {
    const x = BILL.find(y => y.id === brw.dataset.bid);
    if (b.dataset.ba === 'up') { const [f] = await pick('application/pdf,image/*'); if (!f) return; if (f.size > MAX_FILE) { toast('Fichier trop lourd (50 Mo max)'); return; } try { const old = x.file; x.file = await upload(`${P.id}/fact/${uid()}-${safeName(f.name)}`, f); x.fname = f.name; if (old) sb.storage.from('espace').remove([old]); await signFiles([x.file]); saveBill(x); renderAdmin(); toast('PDF importé'); } catch (er) { toast('Import impossible : ' + (er.message || '')); } }
    if (b.dataset.ba === 'unacc') confirmBtn(b, async () => { const {error} = await sb.from('billing').update({accepted_at:null, accepted_by:null}).eq('id', x.id); if (error) { toast('Impossible pour le moment'); return; } x.accepted_at = null; x.accepted_by = null; renderAdmin(); });
    if (b.dataset.ba === 'del') confirmBtn(b, async () => { Object.keys(Q).filter(k => k === 'bill:' + x.id).forEach(k => { clearTimeout(Q[k].t); delete Q[k]; }); const {error} = await sb.from('billing').delete().eq('id', x.id); if (error) { toast('Suppression impossible'); return; } if (x.file) sb.storage.from('espace').remove([x.file]); BILL = BILL.filter(y => y !== x); renderAdmin(); });
  }
}
document.addEventListener('submit', e => { if (e.target.id === 'addMem') { e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); if (btn) btn.click(); } });

/* ---------- nouveautés côté client pendant que la gestion est ouverte ---------- */
async function refreshAdmin() {
  if (!P || !isAdmin || mode !== 'edit' || document.visibilityState !== 'visible') return;
  const [rv, br, bi] = await Promise.all([
    sb.from('post_reviews').select('*').eq('project_id', P.id).order('created_at', {ascending:true}),
    sb.from('briefs').select('*').eq('project_id', P.id).maybeSingle(),
    sb.from('billing').select('id,accepted_at,accepted_by').eq('project_id', P.id)]);
  if (!P) return;
  let news = [];
  const before = Object.values(REV).reduce((s, a) => s + a.length, 0);
  if (rv.data && rv.data.length !== before) { mapReviews(rv.data); news.push('nouvelle réponse sur un post'); }
  if (br.data && (!BRIEF || br.data.updated_at !== BRIEF.updated_at)) { const sub = br.data.submitted && !(BRIEF && BRIEF.submitted); BRIEF = br.data; await signFiles([...(BD().files || []), ...(BD().voice || [])].map(f => f.path)); if (sub) news.push('brief reçu'); }
  (bi.data || []).forEach(x => { const b = BILL.find(y => y.id === x.id); if (b && x.accepted_at && !b.accepted_at) { b.accepted_at = x.accepted_at; b.accepted_by = x.accepted_by; news.push('devis accepté'); } });
  if (!news.length) return;
  toast('Du nouveau : ' + news.join(', '));
  const f = document.activeElement; if (f && f.closest && f.closest('#app') && f.matches('input,textarea,select')) return;
  if (!Object.keys(Q).length) renderAdmin();
}
document.addEventListener('visibilitychange', refreshAdmin);
setInterval(refreshAdmin, 60000);
})();
