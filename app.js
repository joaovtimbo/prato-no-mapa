import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text='') => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateLabel = (str) => str ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(str)) : 'Agora';
const fullDate = (str) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(str));
const randomId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
const DEMO_KEY='pratonomapa_demo_v1';
const emojiFor = (name) => /sushi|japon|temaki|ramen/i.test(name)?'🍣':/pizza|pizzaria|italian|massa/i.test(name)?'🍕':/café|cafe|coffee|padaria/i.test(name)?'☕':/burger|hamb|lanche/i.test(name)?'🍔':'🍽️';
const classFor = (name) => /sushi|japon|temaki|ramen/i.test(name)?'sushi':/pizza|pizzaria|italian|massa/i.test(name)?'pizza':/café|cafe|coffee|padaria/i.test(name)?'cafe':/burger|hamb|lanche/i.test(name)?'burger':'other';
const prettyStars = v => '★'.repeat(Math.round(Number(v)))+'☆'.repeat(5-Math.round(Number(v)));
let supabase=null, live=false, user=null, profile=null;
let restaurants=[], reviews=[], friends=[], profiles={}, pendingPoint=null, searchResults=[], activePage='explore', feedFilter='all', sortLatest=true, map, markersLayer;
const demoSeed = {
  name:'Visitante',
  restaurants:[
    {id:'demo1',name:'Casa da Pizza',address:'Pinheiros, São Paulo',lat:-23.5651,lng:-46.6882,created_at:'2026-10-25T16:00:00Z'},
    {id:'demo2',name:'Sushi da Esquina',address:'Vila Madalena, São Paulo',lat:-23.5514,lng:-46.6906,created_at:'2026-10-28T16:00:00Z'},
    {id:'demo3',name:'Café do Jardim',address:'Jardins, São Paulo',lat:-23.5685,lng:-46.6618,created_at:'2026-10-30T16:00:00Z'},
    {id:'demo4',name:'Burger da Vila',address:'Consolação, São Paulo',lat:-23.5576,lng:-46.6596,created_at:'2026-11-02T16:00:00Z'}
  ],
  reviews:[
    {id:'rev1',user_id:'demo-me',restaurant_id:'demo2',rating:4.5,note:'Peixe muito fresco, atendimento caprichado. Voltaria para provar o combinado da casa!',created_at:'2026-11-02T16:00:00Z'},
    {id:'rev2',user_id:'demo-friend',restaurant_id:'demo1',rating:5,note:'A massa era incrível. Aquele tipo de lugar para voltar com quem a gente gosta. 🍕',created_at:'2026-11-01T16:00:00Z'},
    {id:'rev3',user_id:'demo-me',restaurant_id:'demo3',rating:4,note:'Café ótimo e um cantinho perfeito para conversar sem pressa.',created_at:'2026-10-30T16:00:00Z'},
    {id:'rev4',user_id:'demo-friend',restaurant_id:'demo4',rating:4.5,note:'O hambúrguer surpreendeu! Batata bem crocante.',created_at:'2026-10-29T16:00:00Z'}
  ]
};
let demoData;
try{demoData=JSON.parse(localStorage.getItem(DEMO_KEY))||structuredClone(demoSeed)}catch{demoData=structuredClone(demoSeed)}
function persistDemo(){localStorage.setItem(DEMO_KEY,JSON.stringify(demoData))}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('visible'),3500)}
function modal(html){$('#modalContent').innerHTML=html;$('#modalBackdrop').classList.remove('hidden')}
function closeModal(){$('#modalBackdrop').classList.add('hidden');pendingPoint=null}
$('#modalClose').addEventListener('click',closeModal);
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});

let userLocation=null,userMarker=null;
function locateUser(silent=false){
 if(!navigator.geolocation){if(!silent)toast('Seu navegador não oferece localização.');return}
 navigator.geolocation.getCurrentPosition(pos=>{
  userLocation=[pos.coords.latitude,pos.coords.longitude];
  if(userMarker)map.removeLayer(userMarker);
  userMarker=L.marker(userLocation,{icon:L.divIcon({html:'<div class="gps-dot"></div>',iconSize:[20,20],iconAnchor:[10,10],className:''})}).addTo(map).bindPopup('Sua localização');
  map.setView(userLocation,15);if(!silent)toast('Localização atualizada.');
 },err=>{if(!silent)toast(err.code===1?'Permita a localização nas configurações do navegador.':'Não foi possível obter sua localização.');},{enableHighAccuracy:true,timeout:12000,maximumAge:120000})
}
function initializeMap(){
 map=L.map('map',{zoomControl:false}).setView([-15.78,-47.93],4);
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'}).addTo(map);
 markersLayer=L.layerGroup().addTo(map);
 map.on('click',e=>openNewPlace({lat:e.latlng.lat,lng:e.latlng.lng}));
 setTimeout(()=>locateUser(true),500);
}
function currentUserId(){return live?user?.id:'demo-me'}
function getRestaurant(id){return restaurants.find(r=>String(r.id)===String(id))}
function reviewByMe(id){return reviews.find(r=>r.restaurant_id===id&&r.user_id===currentUserId())}
function mineReviews(){return reviews.filter(r=>r.user_id===currentUserId())}
function friendCount(){return live?friends.filter(f=>f.status==='accepted').length:1}
function displayName(id){if(id===currentUserId())return profile?.display_name||demoData.name||'Você';return profiles[id]?.display_name||'Amigo'}
function activeReview(r){return !!reviews.find(v=>v.restaurant_id===r.id)}
function sortByDate(arr){return [...arr].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))}
function render(){renderStats();renderRestaurants();renderFeed();renderProfile();renderMap();}
function renderStats(){const mine=mineReviews(),avg=mine.length?(mine.reduce((a,b)=>a+Number(b.rating),0)/mine.length).toFixed(1).replace('.',','):'—';$('#statVisits').textContent=mine.length;$('#statAverage').textContent=avg;$('#statFriends').textContent=friendCount();$('#profileReviews').textContent=mine.length;$('#profileAverage').textContent=avg;$('#profileFriends').textContent=friendCount();}
function renderRestaurants(){
 const query=$('#searchInput').value.trim().toLowerCase();
 let list=restaurants.filter(r=>!query||`${r.name} ${r.address}`.toLowerCase().includes(query));
 list=sortLatest?sortByDate(list):[...list].sort((a,b)=>a.name.localeCompare(b.name));
 $('#placesCount').textContent=list.length;
 $('#restaurantList').innerHTML=list.length?list.map(r=>{
  const mine=reviewByMe(r.id), all=reviews.filter(v=>v.restaurant_id===r.id), avg=all.length?(all.reduce((a,b)=>a+Number(b.rating),0)/all.length).toFixed(1).replace('.',','):'—';
  return `<button class="place-card" data-open-place="${escapeHtml(r.id)}"><div class="place-visual ${classFor(r.name)}">${emojiFor(r.name)}</div><div class="place-content"><div class="place-name">${escapeHtml(r.name)}</div><div class="place-address">${escapeHtml(r.address||'Endereço não informado')}</div><div class="place-foot"><span class="place-rating">★ ${mine?Number(mine.rating).toFixed(1).replace('.',','):avg} <span>${mine?'sua nota':all.length?'na rede':'sem nota'}</span></span><span class="place-date">${mine?dateLabel(mine.created_at):''}</span></div></div></button>`;
 }).join(''):`<div class="empty-state"><strong>Nenhum restaurante ainda</strong><p>${query?'Tente outra busca.':'Adicione seu primeiro restaurante.'}</p></div>`;
}
function feedMarkup(items){
 if(!items.length)return '<div class="empty-state"><strong>Sem avaliações ainda</strong></div>';
 return sortByDate(items).map(r=>{const place=getRestaurant(r.restaurant_id),isMine=r.user_id===currentUserId();return `<article class="feed-card"><div class="feed-user"><div class="tiny-avatar">${escapeHtml(displayName(r.user_id).charAt(0).toUpperCase())}</div><span>${escapeHtml(isMine?'Você':displayName(r.user_id))}</span><span class="feed-time">${dateLabel(r.created_at)}</span></div><div class="feed-place" data-open-place="${escapeHtml(r.restaurant_id)}">${emojiFor(place?.name||'')} ${escapeHtml(place?.name||'Restaurante')}</div><div class="feed-address">${escapeHtml(place?.address||'')}</div><div class="feed-rating">★ ${Number(r.rating).toFixed(1).replace('.',',')} <small>/ 5,0</small></div>${r.note?`<p class="feed-note">${escapeHtml(r.note)}</p>`:''}${isMine?`<div class="feed-actions"><button class="text-action" data-edit-review="${escapeHtml(r.restaurant_id)}">Editar</button><button class="text-action danger" data-delete-review="${escapeHtml(r.id)}">Excluir</button></div>`:''}</article>`}).join('');
}
function renderFeed(){const list=feedFilter==='mine'?mineReviews():feedFilter==='friends'?reviews.filter(r=>r.user_id!==currentUserId()):reviews;$('#feedList').innerHTML=feedMarkup(list);}
function renderProfile(){
 const name=profile?.display_name||demoData.name||'Visitante',handle=profile?.username||(live?'usuário':'visitante');
 $('#profileName').textContent=name;$('#profileHandle').textContent='@'+handle;$('#profileAvatar').textContent=name.charAt(0).toUpperCase();
 $('#myReviews').innerHTML=feedMarkup(mineReviews());
 $('#authArea').innerHTML=live?(user?`<div class="mode-box"><strong>Você está conectado ✓</strong><p>Suas avaliações ficam salvas na nuvem e aparecem para amigos aceitos.</p><button id="logoutButton" class="secondary-btn">Sair da conta</button></div>`:`<div class="mode-box"><strong>Sua conta</strong><p>Crie sua conta para salvar avaliações, buscar amigos e sincronizar o celular.</p><button id="loginButton">Entrar ou criar conta</button></div>`):`<div class="mode-box"><strong>✳ Versão de demonstração</strong><p>Você pode avaliar e explorar agora. Os dados de teste ficam apenas neste navegador. Para compartilhar avaliações de verdade, configure o Supabase conforme o README.</p><button id="editDemoName">Alterar meu nome</button></div>`;
 if(!live){$('#friendList').innerHTML=`<div class="friend-row"><div class="tiny-avatar friend">L</div><div><strong>Lia (exemplo)</strong><small>@lia_demo</small></div><span class="status-label">Demonstração</span></div>`;return}
 const rows=friends.map(f=>{const otherId=f.sender_id===user.id?f.recipient_id:f.sender_id,other=profiles[otherId]||{},waiting=f.status==='pending',incoming=f.recipient_id===user.id;return `<div class="friend-row"><div class="tiny-avatar">${escapeHtml((other.display_name||'?')[0])}</div><div><strong>${escapeHtml(other.display_name||'Usuário')}</strong><small>@${escapeHtml(other.username||'')}</small></div>${waiting&&incoming?`<button data-accept="${f.id}">Aceitar</button>`:`<span class="status-label">${waiting?'Convite enviado':'Amigos ✓'}</span>`}</div>`}).join('');
 $('#friendList').innerHTML=rows||`<div class="empty-state"><p>Encontre alguém pelo @usuário e envie um convite.</p></div>`;
}
function renderMap(){if(!map)return;markersLayer.clearLayers();restaurants.forEach(r=>{if(!Number.isFinite(Number(r.lat))||!Number.isFinite(Number(r.lng)))return;const mine=reviewByMe(r.id),isFriend=!mine&&reviews.some(v=>v.restaurant_id===r.id);const icon=L.divIcon({html:`<div class="pin-marker ${isFriend?'friend-pin':''}"><span>${emojiFor(r.name)}</span></div>`,iconSize:[40,44],iconAnchor:[20,39],popupAnchor:[0,-35]});L.marker([r.lat,r.lng],{icon}).addTo(markersLayer).bindPopup(`<div class="map-popup"><strong>${escapeHtml(r.name)}</strong><small>${escapeHtml(r.address||'')}</small><button data-open-place="${escapeHtml(r.id)}">${mine?'Ver minha avaliação':'Avaliar este lugar'}</button></div>`)});}
function fitAll(){const locs=restaurants.filter(r=>Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng))).map(r=>[r.lat,r.lng]);if(locs.length)map.fitBounds(L.latLngBounds(locs).pad(.22),{maxZoom:14});else if(userLocation)map.setView(userLocation,15);else toast('Nenhum restaurante cadastrado ainda.')}
function switchPage(page){activePage=page;$('#sectionTitle').textContent=({explore:'Restaurantes',feed:'Avaliações',profile:'Perfil'})[page];$('#headerSubtitle').textContent=({explore:'Sua lista no mapa',feed:'Você e seus amigos',profile:'Sua conta e amizades'})[page];document.querySelectorAll('.panel-page').forEach(el=>el.classList.toggle('active',el.id==='page-'+page));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));if(page==='explore')setTimeout(()=>map.invalidateSize(),180)}
function openPlace(id){const r=getRestaurant(id);if(!r)return;const mine=reviewByMe(id);const others=reviews.filter(x=>x.restaurant_id===id&&x.user_id!==currentUserId());modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> RESTAURANTE NO MAPA</div><h2>${emojiFor(r.name)} ${escapeHtml(r.name)}</h2><p>${escapeHtml(r.address||'Localização cadastrada')}</p><div class="modal-location">📍 <strong>Local no mapa</strong> · ${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}</div>${mine?`<div class="feed-card" style="margin-top:15px"><strong>Sua avaliação · ★ ${Number(mine.rating).toFixed(1).replace('.',',')}</strong><p style="margin:9px 0 0">${escapeHtml(mine.note||'Sem comentário')}</p></div>`:''}${others.length?`<div style="margin-top:16px"><div class="mini-eyebrow" style="margin-bottom:10px">AMIGOS QUE CONHECEM</div>${feedMarkup(others)}</div>`:''}${mine?`<div class="feed-actions"><button class="text-action danger" data-delete-review="${escapeHtml(mine.id)}">Excluir avaliação</button></div>`:''}<div class="form-actions"><button class="btn-secondary" id="showOnMap">Ver no mapa</button><button class="btn-primary" id="reviewSelected">${mine?'Editar minha nota':'Avaliar este lugar'}</button></div>`);$('#reviewSelected').addEventListener('click',()=>openReview(r));$('#showOnMap').addEventListener('click',()=>{closeModal();switchPage('explore');map.setView([r.lat,r.lng],16)})}
async function geocodeAddress(query){
 const res=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,{headers:{Accept:'application/json'}});
 if(!res.ok)throw new Error('Serviço de localização indisponível. Tente novamente.');return res.json();
}
function openNewPlace(point=null){
 if(live&&!user){openAuth();return}
 let chosen=point;
 modal(`<h2>Adicionar restaurante</h2><form id="newPlaceForm"><div class="field"><label>Nome</label><input required id="newPlaceName" class="form-input" maxlength="100" placeholder="Nome do restaurante"/></div><div class="field"><label>Endereço completo</label><input id="newPlaceAddress" class="form-input" maxlength="180" placeholder="Rua, número, cidade"/></div><button type="button" class="btn-secondary" id="verifyAddress" style="border:0;border-radius:10px;padding:11px;width:100%">Buscar endereço no mapa</button><div id="geocodeOptions"></div><div class="modal-location" id="selectedCoordinates">${point?'Ponto selecionado no mapa. Você pode manter ou pesquisar um endereço.':'Encontre e selecione o endereço antes de continuar.'}</div><div class="form-actions"><button type="button" class="btn-secondary" id="cancelNew">Cancelar</button><button class="btn-primary" type="submit">Continuar</button></div></form>`);
 $('#cancelNew').onclick=closeModal;
 $('#newPlaceAddress').addEventListener('input',()=>{chosen=null;$('#selectedCoordinates').textContent='Selecione um resultado da busca para confirmar a localização.'});
 $('#verifyAddress').onclick=async()=>{
  const query=$('#newPlaceAddress').value.trim();if(query.length<5){toast('Digite um endereço mais completo.');return}
  const b=$('#verifyAddress');b.disabled=true;b.textContent='Localizando...';
  try{const found=await geocodeAddress(query);$('#geocodeOptions').innerHTML=found.length?found.map((p,i)=>`<button type="button" class="search-result" data-geocode="${i}">${escapeHtml(p.display_name)}</button>`).join(''):'<p class="helper-text">Nenhum endereço encontrado. Inclua número e cidade ou selecione o local no mapa.</p>';
  $('#geocodeOptions').querySelectorAll('[data-geocode]').forEach(button=>button.onclick=()=>{const p=found[Number(button.dataset.geocode)];chosen={lat:Number(p.lat),lng:Number(p.lon)};$('#newPlaceAddress').value=p.display_name.slice(0,180);$('#selectedCoordinates').textContent='✓ Localização confirmada no mapa';$('#geocodeOptions').innerHTML='';});
  }catch(err){toast(err.message)}finally{b.disabled=false;b.textContent='Buscar endereço no mapa'}
 };
 $('#newPlaceForm').onsubmit=e=>{e.preventDefault();if(!chosen){toast('Confirme o endereço para posicionar o restaurante corretamente.');return}const name=$('#newPlaceName').value.trim(),address=$('#newPlaceAddress').value.trim();closeModal();map.setView([chosen.lat,chosen.lng],16);openReview({id:null,name,address,lat:chosen.lat,lng:chosen.lng})};
}
function openReview(r){if(live&&!user){openAuth();return}const old=r.id?reviewByMe(r.id):null;let rating=old?Number(old.rating):0;modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> AVALIAÇÃO</div><h2>Como foi no ${escapeHtml(r.name)}?</h2><p></p><form id="reviewForm"><div class="field"><label>SUA NOTA</label><div class="rating-picker" id="ratingPicker">${[1,2,3,4,5].map(v=>`<button type="button" class="rating-star ${v<=Math.ceil(rating)?'selected':''}" data-rating="${v}" aria-label="${v} estrelas">★</button>`).join('')}<span class="rating-value" id="ratingValue">${rating?rating.toFixed(1).replace('.',',')+' / 5,0':'Escolha uma nota'}</span></div><small class="helper-text">Toque em uma estrela para a nota inteira; toque novamente para meia estrela.</small></div><div class="field"><label for="reviewNote">SUA REVIEW (OPCIONAL)</label><textarea id="reviewNote" class="form-textarea" maxlength="500" placeholder="O que você pediu? O que valeu a pena? Voltaria?">${escapeHtml(old?.note||'')}</textarea></div><div class="form-actions"><button type="button" class="btn-secondary" id="cancelReview">Cancelar</button><button class="btn-primary" type="submit">Salvar avaliação ✳</button></div></form>`);
 $('#cancelReview').addEventListener('click',closeModal);
 $('#ratingPicker').addEventListener('click',e=>{const b=e.target.closest('[data-rating]');if(!b)return;const v=Number(b.dataset.rating);rating=(rating===v)?v-.5:v;document.querySelectorAll('.rating-star').forEach((star,i)=>star.classList.toggle('selected',i<Math.ceil(rating)));$('#ratingValue').textContent=rating.toFixed(1).replace('.',',')+' / 5,0'});
 $('#reviewForm').addEventListener('submit',async e=>{e.preventDefault();if(!rating){toast('Escolha uma nota de 0,5 a 5 estrelas.');return}const button=e.target.querySelector('[type=submit]');button.disabled=true;try{await saveReview(r,rating,$('#reviewNote').value.trim());closeModal();toast('Avaliação salva no seu mapa! ✳');render()}catch(error){console.error(error);toast('Não foi possível salvar: '+(error.message||error))}finally{button.disabled=false}})
}
async function saveReview(r,rating,note){
 let rid=r.id;
 if(live){if(!user)throw new Error('Faça login para continuar.');if(!rid){const {data,error}=await supabase.from('restaurants').insert({name:r.name,address:r.address||'',lat:r.lat,lng:r.lng,created_by:user.id}).select('id').single();if(error)throw error;rid=data.id}const {error}=await supabase.from('reviews').upsert({user_id:user.id,restaurant_id:rid,rating,note},{onConflict:'user_id,restaurant_id'});if(error)throw error;await loadLiveData()}
 else{if(!rid){rid=randomId();demoData.restaurants.push({...r,id:rid,created_at:new Date().toISOString()})}const prev=demoData.reviews.find(v=>v.user_id==='demo-me'&&v.restaurant_id===rid);if(prev){prev.rating=rating;prev.note=note;prev.created_at=new Date().toISOString()}else demoData.reviews.push({id:randomId(),user_id:'demo-me',restaurant_id:rid,rating,note,created_at:new Date().toISOString()});persistDemo();loadDemo()}
}
async function deleteReview(id){
 const review=reviews.find(r=>String(r.id)===String(id));if(!review||review.user_id!==currentUserId())return;
 if(!window.confirm('Excluir esta avaliação? Esta ação não pode ser desfeita.'))return;
 try{if(live){const {error}=await supabase.from('reviews').delete().eq('id',review.id).eq('user_id',user.id);if(error)throw error;await loadLiveData();}
 else{demoData.reviews=demoData.reviews.filter(r=>String(r.id)!==String(id));persistDemo();loadDemo()}
 closeModal();toast('Avaliação excluída.');render();
 }catch(err){toast('Não foi possível excluir: '+err.message)}
}
function loadDemo(){restaurants=[...demoData.restaurants];reviews=[...demoData.reviews];friends=[{status:'accepted',sender_id:'demo-me',recipient_id:'demo-friend'}];profiles={'demo-friend':{display_name:'Lia',username:'lia_demo'}};profile={display_name:demoData.name,username:'visitante'};render()}
async function initializeBackend(){
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY){$('#appStatus').textContent='Modo demonstração • dados locais';loadDemo();return}
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);live=true;$('#appStatus').textContent='Conectado ao Supabase';const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;supabase.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setTimeout(()=>loadLiveData().catch(err=>toast(err.message)),0)});await loadLiveData();if(!user)openAuth()}catch(err){console.error(err);live=false;toast('Falha de conexão. Abrindo demonstração.');loadDemo()}
}
async function loadLiveData(){
 if(!user){restaurants=[];reviews=[];friends=[];profiles={};profile=null;render();return}
 const results=await Promise.all([supabase.from('profiles').select('*').eq('id',user.id).single(),supabase.from('friendships').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),supabase.from('reviews').select('*').order('created_at',{ascending:false}),supabase.from('restaurants').select('*')]);
 for(const r of results){if(r.error && r.error.code!=='PGRST116')throw r.error}
 profile=results[0].data;friends=results[1].data||[];reviews=results[2].data||[];restaurants=results[3].data||[];
 const ids=[...new Set(friends.map(f=>f.sender_id===user.id?f.recipient_id:f.sender_id).concat(reviews.map(r=>r.user_id)).filter(id=>id!==user.id))];profiles={};if(ids.length){const {data,error}=await supabase.from('profiles').select('id,username,display_name').in('id',ids);if(error)throw error;for(const p of data||[])profiles[p.id]=p}
 render();
}
function openAuth(){if(!live)return;let mode='login';const paint=()=>{modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> ENTRE PARA O CLUBE</div><h2>Entrar ou criar conta</h2><p>Salve suas avaliações e veja as de amigos.</p><div class="auth-toggle"><button id="tabLogin" class="${mode==='login'?'active':''}">Entrar</button><button id="tabSignup" class="${mode==='signup'?'active':''}">Criar conta</button></div><form id="authForm">${mode==='signup'?`<div class="field"><label>NOME EXIBIDO</label><input required class="form-input" id="authName" maxlength="50" placeholder="Seu nome"/></div><div class="field"><label>NOME DE USUÁRIO (SEM @)</label><input required pattern="[a-zA-Z0-9_]{3,30}" class="form-input" id="authUsername" maxlength="30" placeholder="meunome"/></div>`:''}<div class="field"><label>E-MAIL</label><input required type="email" class="form-input" id="authEmail" placeholder="voce@email.com"/></div><div class="field"><label>SENHA</label><input required type="password" minlength="6" class="form-input" id="authPassword" placeholder="Mínimo de 6 caracteres"/></div><div class="form-actions"><button class="btn-primary" type="submit">${mode==='login'?'Entrar':'Criar minha conta'} →</button></div></form><p class="helper-text">${mode==='signup'?'Pode ser necessário confirmar o e-mail antes de entrar.':'Suas informações são protegidas pelo Supabase Auth.'}</p>`);$('#tabLogin').onclick=()=>{mode='login';paint()};$('#tabSignup').onclick=()=>{mode='signup';paint()};$('#authForm').onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;const email=$('#authEmail').value.trim(),password=$('#authPassword').value;try{if(mode==='signup'){const username=$('#authUsername').value.trim().toLowerCase(),displayName=$('#authName').value.trim();const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username,display_name:displayName}}});if(error)throw error;closeModal();toast(data.session?'Conta criada com sucesso!':'Conta criada! Confira seu e-mail para confirmar o cadastro.')}else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;closeModal();toast('Que bom ter você por aqui!')}}catch(err){toast(err.message||'Não foi possível entrar.')}finally{btn.disabled=false}}};paint()}
async function addFriend(){if(!live){toast('Amizades reais precisam do Supabase configurado.');return}if(!user){openAuth();return}const username=$('#friendInput').value.trim().replace(/^@/,'').toLowerCase();if(!username){toast('Digite um nome de usuário.');return}if(username===profile?.username){toast('Você já está no seu próprio mapa!');return}try{const {data:person,error}=await supabase.from('profiles').select('id,username,display_name').eq('username',username).maybeSingle();if(error)throw error;if(!person){toast('Usuário não encontrado.');return}if(friends.some(f=>[f.sender_id,f.recipient_id].includes(person.id))){toast('Vocês já têm uma solicitação ou amizade.');return}const {error:err}=await supabase.from('friendships').insert({sender_id:user.id,recipient_id:person.id});if(err)throw err;$('#friendInput').value='';await loadLiveData();toast('Pedido de amizade enviado!')}catch(err){toast(err.message||'Não foi possível enviar o convite.')}}
async function acceptFriend(id){try{const {error}=await supabase.from('friendships').update({status:'accepted'}).eq('id',id).eq('recipient_id',user.id);if(error)throw error;await loadLiveData();toast('Agora vocês são amigos!')}catch(err){toast(err.message)}}
async function searchMapPlaces(){let query=$('#searchInput').value.trim();if(query.length<3){toast('Digite pelo menos 3 caracteres para buscar no mapa.');return}const btn=$('#searchPlaces');btn.disabled=true;btn.textContent='Buscando lugares...';try{const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=7&addressdetails=1&q=${encodeURIComponent(query)}`;const res=await fetch(url,{headers:{'Accept':'application/json'}});if(!res.ok)throw new Error('Serviço de busca indisponível');searchResults=await res.json();$('#searchResults').classList.remove('hidden');$('#searchResults').innerHTML=searchResults.length?searchResults.map((p,i)=>`<button class="search-result" data-result="${i}"><strong>${escapeHtml(p.name||p.display_name.split(',')[0])}</strong><small>${escapeHtml(p.display_name)}</small></button>`).join(''):`<div style="padding:12px;font-size:12px;color:#8e9c8d">Nenhum lugar encontrado. Tente incluir a cidade ou marque diretamente no mapa.</div>`}catch(err){toast('Busca não disponível no momento. Você pode marcar o local no mapa.')}finally{btn.disabled=false;btn.textContent='Buscar'}}
function selectSearchResult(i){const p=searchResults[i];if(!p)return;const lat=Number(p.lat),lng=Number(p.lon),name=p.name||p.display_name.split(',')[0];$('#searchResults').classList.add('hidden');map.setView([lat,lng],17);switchPage('explore');const existing=restaurants.find(r=>r.name.toLowerCase()===name.toLowerCase()&&Math.abs(r.lat-lat)<.002&&Math.abs(r.lng-lng)<.002);if(existing)openPlace(existing.id);else openReview({id:null,name,address:p.display_name,lat,lng})}

initializeMap();initializeBackend();
document.addEventListener('click',e=>{
 const del=e.target.closest('[data-delete-review]');if(del){deleteReview(del.dataset.deleteReview);return}
 const edit=e.target.closest('[data-edit-review]');if(edit){const r=getRestaurant(edit.dataset.editReview);if(r)openReview(r);return}
 const link=e.target.closest('[data-open-place]');if(link){e.preventDefault();openPlace(link.dataset.openPlace);return}
 const result=e.target.closest('[data-result]');if(result){selectSearchResult(Number(result.dataset.result));return}
 const accepted=e.target.closest('[data-accept]');if(accepted){acceptFriend(accepted.dataset.accept);return}
 if(e.target.closest('#loginButton'))openAuth();
 if(e.target.closest('#logoutButton'))supabase.auth.signOut().then(()=>{toast('Você saiu da conta.');switchPage('explore')});
 if(e.target.closest('#editDemoName')){const name=prompt('Como você gostaria de aparecer?',demoData.name);if(name?.trim()){demoData.name=name.trim().slice(0,50);persistDemo();loadDemo()}}
});
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
document.querySelectorAll('[data-feed-filter]').forEach(b=>b.addEventListener('click',()=>{feedFilter=b.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(x=>x.classList.toggle('active',x===b));renderFeed()}));
$('#searchInput').addEventListener('input',()=>{$('#clearSearch').classList.toggle('hidden',!$('#searchInput').value);renderRestaurants();$('#searchResults').classList.add('hidden')});
$('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchMapPlaces()}});
$('#clearSearch').onclick=()=>{$('#searchInput').value='';$('#clearSearch').classList.add('hidden');$('#searchResults').classList.add('hidden');renderRestaurants()};
$('#searchPlaces').onclick=searchMapPlaces;
$('#sortButton').onclick=()=>{sortLatest=!sortLatest;$('#sortButton').textContent=sortLatest?'Mais recentes ↓':'Nome A–Z ↓';renderRestaurants()};
$('#addPlaceSide').onclick=()=>openNewPlace();$('#floatingAdd').onclick=()=>openNewPlace();
$('#addFriendButton').onclick=addFriend;
$('#friendInput').addEventListener('keydown',e=>{if(e.key==='Enter')addFriend()});
$('#locateButton').onclick=()=>locateUser(false);
$('#resetMapButton').onclick=fitAll;
window.addEventListener('resize',()=>map.invalidateSize());
