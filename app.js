import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (text='') => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateLabel = (str) => str ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(str)) : 'Agora';
const fullDate = (str) => new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(str));
const randomId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
const DEMO_KEY='pratonomapa_demo_v1';
const emojiFor = (name) => /sushi|japon|temaki|ramen/i.test(name)?'🍣':/pizza|pizzaria|italian|massa/i.test(name)?'🍕':/café|cafe|coffee|padaria/i.test(name)?'☕':/burger|hamb|lanche/i.test(name)?'🍔':'🍽️';
const classFor = (name) => /sushi|japon|temaki|ramen/i.test(name)?'sushi':/pizza|pizzaria|italian|massa/i.test(name)?'pizza':/café|cafe|coffee|padaria/i.test(name)?'cafe':/burger|hamb|lanche/i.test(name)?'burger':'other';
const moneyBR = v => v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const avatarHtml = (obj, name, cls='tiny-avatar') => obj?.avatar_url ? `<span class="${cls} photo-avatar"><img src="${escapeHtml(obj.avatar_url)}" alt="Foto de ${escapeHtml(name)}" loading="lazy" referrerpolicy="no-referrer"></span>` : `<span class="${cls}">${escapeHtml((name||'?')[0].toUpperCase())}</span>`;
const reviewDetails = r => {const entries=[['O que pediu',r.ordered_item],['O que valeu a pena',r.highlights],['Voltaria?',r.would_return],['Valor da conta',moneyBR(r.bill_amount)]];return entries.filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>`<div class="review-detail"><small>${k}</small><span>${escapeHtml(v)}</span></div>`).join('')};
const prettyStars = v => '★'.repeat(Math.round(Number(v)))+'☆'.repeat(5-Math.round(Number(v)));
let supabase=null, live=false, user=null, profile=null;
let restaurants=[], reviews=[], friends=[], profiles={}, pendingPoint=null, searchResults=[], activePage='explore', feedFilter='all', sortLatest=true, map, markersLayer=[];
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

let userLocation=null,userMarker=null,accuracyCircle=null,hasInteractedWithMap=false;
let positionRequest=0;
let gpsHasResolved=false;
function locationHint(message, temporary=false){
 const el=$('#locationHint');if(!el)return;
 el.textContent=message;el.classList.remove('hidden');
 if(temporary){clearTimeout(locationHint.timeout);locationHint.timeout=setTimeout(()=>el.classList.add('hidden'),6000)}
}
function mapResize(){if(map)map.resize()}
function goToPoint(lat,lng,zoom=16){
 if(!map)return;
 map.easeTo({center:[Number(lng),Number(lat)],zoom,duration:500});
}
function locateUser(silent=false){
 if(!navigator.geolocation){locationHint('Este navegador não oferece geolocalização.');return}
 const request=++positionRequest;
 locationHint('Obtendo localização do aparelho…');
 $('#locateButton').disabled=true;
 navigator.geolocation.getCurrentPosition(pos=>{
  if(request!==positionRequest)return;
  $('#locateButton').disabled=false;
  const lat=pos.coords.latitude,lng=pos.coords.longitude;
  const accuracy=Math.round(pos.coords.accuracy);
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
  userLocation=[lat,lng];gpsHasResolved=true;
  if(userMarker)userMarker.remove();
  const dot=document.createElement('div');dot.className='gps-dot';
  userMarker=new maplibregl.Marker({element:dot,anchor:'center'})
   .setLngLat([lng,lat])
   .setPopup(new maplibregl.Popup({offset:16}).setText(`Sua localização · precisão aproximada de ${accuracy} m`))
   .addTo(map);
  if(!silent||!hasInteractedWithMap)goToPoint(lat,lng,accuracy<=100?16:accuracy<=500?15:13);
  locationHint(accuracy<=100?`Localização encontrada · precisão de ~${accuracy} m`:`Localização aproximada (~${accuracy} m). Ative Localização Precisa no celular.`,true);
  if(!silent)toast(`Localização atualizada (precisão de ~${accuracy} m).`);
 },err=>{
  if(request!==positionRequest)return;
  $('#locateButton').disabled=false;
  const message=err.code===1?'Permita o acesso à localização e ative Localização Precisa no navegador.':err.code===3?'GPS demorou para responder. Toque em ⌖ para tentar novamente.':'Não foi possível obter sua localização. Toque em ⌖ para tentar novamente.';
  locationHint(message);if(!silent)toast(message);gpsHasResolved=true;
  if(!userLocation&&restaurants.length&&!hasInteractedWithMap)fitAll();
 },{enableHighAccuracy:true,timeout:20000,maximumAge:0});
}
function initializeMap(){
 if(!window.maplibregl){locationHint('Mapa indisponível. Recarregue a página com internet.');return}
 map=new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/liberty',
  center:[-47.9,-15.8],zoom:4.4,minZoom:2,maxZoom:19,
  attributionControl:true,dragRotate:false,touchPitch:false,
  cooperativeGestures:false
 });
 map.touchZoomRotate.disableRotation();
 map.on('dragstart',()=>{hasInteractedWithMap=true});
 map.on('zoomstart',e=>{if(e.originalEvent)hasInteractedWithMap=true});
 map.on('error',e=>{console.warn('Falha na camada de mapa:',e.error||e);locationHint('Alguns elementos do mapa não carregaram. Confira sua conexão e atualize a página.',true)});
 map.once('load',()=>{mapResize();renderMap();locationHint('Mapa pronto. Buscando localização…',true)});
 $('#zoomInButton').onclick=()=>map.zoomIn({duration:250});
 $('#zoomOutButton').onclick=()=>map.zoomOut({duration:250});
 setTimeout(()=>{mapResize();locateUser(true)},350);
 window.addEventListener('orientationchange',()=>setTimeout(mapResize,450));
 window.addEventListener('resize',()=>{if(activePage==='explore')mapResize()});
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
 let list=restaurants.filter(r=>(!live || r.created_by===user?.id || reviews.some(v=>v.restaurant_id===r.id)));
 list=sortLatest?sortByDate(list):[...list].sort((a,b)=>a.name.localeCompare(b.name));
 $('#placesCount').textContent=list.length;
 $('#restaurantList').innerHTML=list.length?list.map(r=>{
  const mine=reviewByMe(r.id), all=reviews.filter(v=>v.restaurant_id===r.id), avg=all.length?(all.reduce((a,b)=>a+Number(b.rating),0)/all.length).toFixed(1).replace('.',','):'—';
  return `<button class="place-card" data-open-place="${escapeHtml(r.id)}"><div class="place-visual ${classFor(r.name)}">${emojiFor(r.name)}</div><div class="place-content"><div class="place-name">${escapeHtml(r.name)}</div><div class="place-address">${escapeHtml(r.address||'Endereço não informado')}</div><div class="place-foot"><span class="place-rating">★ ${mine?Number(mine.rating).toFixed(1).replace('.',','):avg} <span>${mine?'sua nota':all.length?'na rede':'sem nota'}</span></span><span class="place-date">${mine?dateLabel(mine.created_at):''}</span></div></div></button>`;
 }).join(''):`<div class="empty-state"><strong>Nenhum restaurante ainda</strong><p>Adicione seu primeiro restaurante.</p></div>`;
}
function feedMarkup(items){
 if(!items.length)return '<div class="empty-state"><strong>Sem avaliações ainda</strong></div>';
 return sortByDate(items).map(r=>{const place=getRestaurant(r.restaurant_id),isMine=r.user_id===currentUserId();return `<article class="feed-card"><div class="feed-user">${avatarHtml(isMine?profile:profiles[r.user_id],displayName(r.user_id))}<span>${escapeHtml(isMine?'Você':displayName(r.user_id))}</span><span class="feed-time">${dateLabel(r.created_at)}</span></div><div class="feed-place" data-open-place="${escapeHtml(r.restaurant_id)}">${emojiFor(place?.name||'')} ${escapeHtml(place?.name||'Restaurante')}</div><div class="feed-address">${escapeHtml(place?.address||'')}</div><div class="feed-rating">★ ${Number(r.rating).toFixed(1).replace('.',',')} <small>/ 5,0</small></div>${reviewDetails(r)?`<div class="review-details">${reviewDetails(r)}</div>`:r.note?`<p class="feed-note">${escapeHtml(r.note)}</p>`:''}${isMine?`<div class="feed-actions"><button class="text-action" data-edit-review="${escapeHtml(r.restaurant_id)}">Editar</button><button class="text-action danger" data-delete-review="${escapeHtml(r.id)}">Excluir</button></div>`:''}</article>`}).join('');
}
function renderFeed(){const list=feedFilter==='mine'?mineReviews():feedFilter==='friends'?reviews.filter(r=>r.user_id!==currentUserId()):reviews;$('#feedList').innerHTML=feedMarkup(list);}
function renderProfile(){
 const name=profile?.display_name||demoData.name||'Visitante',handle=profile?.username||(live?'usuário':'visitante');
 $('#profileName').textContent=name;$('#profileHandle').textContent='@'+handle;$('#profileAvatar').innerHTML=profile?.avatar_url?`<img src="${escapeHtml(profile.avatar_url)}" alt="Sua foto de perfil" referrerpolicy="no-referrer">`:escapeHtml(name.charAt(0).toUpperCase());
 $('#myReviews').innerHTML=feedMarkup(mineReviews());
 $('#authArea').innerHTML=live?(user?`<div class="mode-box"><strong>Você está conectado ✓</strong><p>Suas avaliações ficam salvas na nuvem e aparecem para amigos aceitos.</p><button id="changePhotoButton" class="secondary-btn" type="button">Alterar foto do perfil</button><button id="logoutButton" class="secondary-btn" type="button">Sair da conta</button></div>`:`<div class="mode-box"><strong>Sua conta</strong><p>Crie sua conta para salvar avaliações, buscar amigos e sincronizar o celular.</p><button id="loginButton">Entrar ou criar conta</button></div>`):`<div class="mode-box"><strong>✳ Versão de demonstração</strong><p>Você pode avaliar e explorar agora. Os dados de teste ficam apenas neste navegador. Para compartilhar avaliações de verdade, configure o Supabase conforme o README.</p><button id="editDemoName">Alterar meu nome</button></div>`;
 if(!live){$('#friendList').innerHTML=`<div class="friend-row"><div class="tiny-avatar friend">L</div><div><strong>Lia (exemplo)</strong><small>@lia_demo</small></div><span class="status-label">Demonstração</span></div>`;return}
 const rows=friends.map(f=>{const otherId=f.sender_id===user.id?f.recipient_id:f.sender_id,other=profiles[otherId]||{},waiting=f.status==='pending',incoming=f.recipient_id===user.id;return `<div class="friend-row">${avatarHtml(other,other.display_name||'?')}<div><strong>${escapeHtml(other.display_name||'Usuário')}</strong><small>@${escapeHtml(other.username||'')}</small></div>${waiting&&incoming?`<button data-accept="${f.id}">Aceitar</button>`:`<span class="status-label">${waiting?'Convite enviado':'Amigos ✓'}</span>`}</div>`}).join('');
 $('#friendList').innerHTML=rows||`<div class="empty-state"><p>Encontre alguém pelo @usuário e envie um convite.</p></div>`;
}
function renderMap(){
 if(!map)return;
 markersLayer.forEach(m=>m.remove());markersLayer=[];
 restaurants.filter(r=>!live||r.created_by===user?.id||reviews.some(v=>v.restaurant_id===r.id)).forEach(r=>{
  if(!Number.isFinite(Number(r.lat))||!Number.isFinite(Number(r.lng)))return;
  const mine=reviewByMe(r.id),isFriend=!mine&&reviews.some(v=>v.restaurant_id===r.id);
  const element=document.createElement('div');element.className=`pin-marker ${isFriend?'friend-pin':''}`;
  const emoji=document.createElement('span');emoji.textContent=emojiFor(r.name);element.append(emoji);
  const popupNode=document.createElement('div');popupNode.className='map-popup';
  const title=document.createElement('strong');title.textContent=r.name;
  const address=document.createElement('small');address.textContent=r.address||'';
  const button=document.createElement('button');button.textContent=mine?'Ver minha avaliação':'Avaliar este lugar';
  button.addEventListener('click',()=>{popup.remove();openPlace(r.id)});
  popupNode.append(title,address,button);
  const popup=new maplibregl.Popup({offset:28,maxWidth:'260px'}).setDOMContent(popupNode);
  const marker=new maplibregl.Marker({element,anchor:'bottom'})
   .setLngLat([Number(r.lng),Number(r.lat)]).setPopup(popup).addTo(map);
  markersLayer.push(marker);
 });
}
function fitAll(){
 if(!map)return;
 const locs=restaurants.filter(r=>Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lng)))
  .map(r=>[Number(r.lng),Number(r.lat)]);
 if(locs.length===1){map.easeTo({center:locs[0],zoom:15,duration:400});return}
 if(locs.length){const bounds=new maplibregl.LngLatBounds(locs[0],locs[0]);locs.forEach(p=>bounds.extend(p));map.fitBounds(bounds,{padding:55,maxZoom:14,duration:450});}
 else if(userLocation)goToPoint(userLocation[0],userLocation[1],15);
 else toast('Nenhum restaurante cadastrado ainda.');
}
function switchPage(page){activePage=page;document.body.dataset.page=page;$('#sectionTitle').textContent=({explore:'Restaurantes',feed:'Avaliações',profile:'Perfil'})[page];$('#headerSubtitle').textContent=({explore:'Seus lugares',feed:'Notas de vocês',profile:'Conta e amigos'})[page];document.querySelectorAll('.panel-page').forEach(el=>el.classList.toggle('active',el.id==='page-'+page));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.page===page));if(page==='explore')requestAnimationFrame(()=>setTimeout(mapResize,120))}
function openPlace(id){const r=getRestaurant(id);if(!r)return;const mine=reviewByMe(id);const others=reviews.filter(x=>x.restaurant_id===id&&x.user_id!==currentUserId());modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> RESTAURANTE NO MAPA</div><h2>${emojiFor(r.name)} ${escapeHtml(r.name)}</h2><p>${escapeHtml(r.address||'Localização cadastrada')}</p><div class="modal-location">📍 <strong>Local no mapa</strong> · ${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}</div>${mine?`<div class="feed-card" style="margin-top:15px"><strong>Sua avaliação · ★ ${Number(mine.rating).toFixed(1).replace('.',',')}</strong>${reviewDetails(mine)?`<div class="review-details">${reviewDetails(mine)}</div>`:`<p style="margin:9px 0 0">${escapeHtml(mine.note||'Sem comentário')}</p>`}</div>`:''}${others.length?`<div style="margin-top:16px"><div class="mini-eyebrow" style="margin-bottom:10px">AMIGOS QUE CONHECEM</div>${feedMarkup(others)}</div>`:''}${mine?`<div class="feed-actions"><button class="text-action danger" data-delete-review="${escapeHtml(mine.id)}">Excluir avaliação</button></div>`:''}${(!live||r.created_by===user?.id)?`<div class="place-management"><button class="text-action" data-edit-place="${escapeHtml(r.id)}">Editar restaurante</button><button class="text-action danger" data-delete-place="${escapeHtml(r.id)}">Excluir restaurante</button></div>`:''}<div class="form-actions"><button class="btn-secondary" id="showOnMap">Ver no mapa</button><button class="btn-primary" id="reviewSelected">${mine?'Editar minha nota':'Avaliar este lugar'}</button></div>`);$('#reviewSelected').addEventListener('click',()=>openReview(r));$('#showOnMap').addEventListener('click',()=>{closeModal();switchPage('explore');goToPoint(r.lat,r.lng,16)})}

function editPlace(id){
 const r=getRestaurant(id);if(!r || (live&&r.created_by!==user?.id))return;
 let chosen={lat:Number(r.lat),lng:Number(r.lng)};
 modal(`<h2>Editar restaurante</h2><p>Altere o nome ou confirme outro endereço.</p><form id="editPlaceForm"><div class="field"><label for="editPlaceName">Nome</label><input id="editPlaceName" class="form-input" maxlength="100" required value="${escapeHtml(r.name)}"></div><div class="field"><label for="editPlaceAddress">Endereço</label><input id="editPlaceAddress" class="form-input" maxlength="180" value="${escapeHtml(r.address||'')}"></div><button id="editPlaceFind" class="btn-secondary full-button" type="button">Encontrar endereço</button><div id="editGeocodeOptions"></div><div id="editCoordStatus" class="modal-location">Localização atual mantida</div><div class="form-actions"><button type="button" id="cancelEditPlace" class="btn-secondary">Cancelar</button><button type="submit" class="btn-primary">Salvar alterações</button></div></form>`);
 $('#cancelEditPlace').onclick=closeModal;
 $('#editPlaceAddress').oninput=()=>{chosen=null;$('#editCoordStatus').textContent='Endereço alterado. Localize e confirme para salvar.'};
 $('#editPlaceFind').onclick=async()=>{const query=$('#editPlaceAddress').value.trim();if(query.length<5){toast('Informe um endereço mais completo.');return}const btn=$('#editPlaceFind');btn.disabled=true;try{const found=await geocodeAddress(query);$('#editGeocodeOptions').innerHTML=found.length?found.map((p,i)=>`<button type="button" class="search-result" data-edit-geocode="${i}">${escapeHtml(p.display_name)}</button>`).join(''):'<p class="helper-text">Não encontramos esse endereço. Inclua cidade e número.</p>';$('#editGeocodeOptions').querySelectorAll('button').forEach(b=>b.onclick=()=>{const p=found[Number(b.dataset.editGeocode)];chosen={lat:Number(p.lat),lng:Number(p.lon)};$('#editPlaceAddress').value=p.display_name.slice(0,180);$('#editCoordStatus').textContent='Localização confirmada';$('#editGeocodeOptions').innerHTML=''})}catch(e){toast(e.message)}finally{btn.disabled=false}};
 $('#editPlaceForm').onsubmit=async e=>{e.preventDefault();if(!chosen){toast('Confirme a localização antes de salvar.');return}const btn=e.target.querySelector('[type=submit]');btn.disabled=true;try{const values={name:$('#editPlaceName').value.trim(),address:$('#editPlaceAddress').value.trim(),lat:chosen.lat,lng:chosen.lng};if(live){const {data,error}=await supabase.from('restaurants').update(values).eq('id',id).eq('created_by',user.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Não foi possível alterar este restaurante. Execute o arquivo atualizacao-v3.sql no Supabase.');await loadLiveData()}else{const item=demoData.restaurants.find(x=>x.id===id);Object.assign(item,values);persistDemo();loadDemo()}closeModal();toast('Restaurante atualizado.');render()}catch(err){toast(err.message)}finally{btn.disabled=false}};
}
async function deletePlace(id){
 const r=getRestaurant(id);if(!r || (live&&r.created_by!==user?.id))return;
 const others=reviews.filter(v=>v.restaurant_id===id&&v.user_id!==currentUserId());
 if(others.length){toast('Este restaurante tem avaliações de amigos. Você pode excluir sua avaliação, mas não o lugar.');return}
 if(!confirm(`Excluir "${r.name}" do mapa? Sua avaliação nesse restaurante também será excluída.`))return;
 try{
  if(live){const {data,error}=await supabase.from('restaurants').delete().eq('id',id).eq('created_by',user.id).select('id');if(error)throw error;if(!data?.length)throw new Error('Exclusão não permitida. Execute o arquivo atualizacao-v3.sql no Supabase.');await loadLiveData();}
  else{demoData.restaurants=demoData.restaurants.filter(v=>v.id!==id);demoData.reviews=demoData.reviews.filter(v=>v.restaurant_id!==id);persistDemo();loadDemo()}
  closeModal();toast('Restaurante excluído.');render();
 }catch(err){toast('Não foi possível excluir: '+err.message)}
}

async function geocodeAddress(query){
 const res=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,{headers:{Accept:'application/json'}});
 if(!res.ok)throw new Error('Serviço de localização indisponível. Tente novamente.');return res.json();
}
function openNewPlace(point=null){
 if(live&&!user){openAuth();return}
 let chosen=point;
 modal(`<h2>Adicionar restaurante</h2><form id="newPlaceForm"><div class="field"><label for="newPlaceName">Nome do restaurante</label><input required id="newPlaceName" class="form-input" maxlength="100" placeholder="Comece a digitar para buscar" autocomplete="off" aria-controls="placeSuggestions"/><div id="placeSuggestions" class="place-suggestions" aria-live="polite"></div><small class="helper-text">Selecione uma sugestão para preencher o endereço e marcar no mapa, ou informe o endereço manualmente.</small></div><div class="field"><label>Endereço completo</label><input id="newPlaceAddress" class="form-input" maxlength="180" placeholder="Rua, número, cidade"/></div><button type="button" class="btn-secondary" id="verifyAddress" style="border:0;border-radius:10px;padding:11px;width:100%">Buscar endereço no mapa</button><div id="geocodeOptions"></div><div class="modal-location" id="selectedCoordinates">${point?'Ponto selecionado no mapa. Você pode manter ou pesquisar um endereço.':'Encontre e selecione o endereço antes de continuar.'}</div><div class="form-actions"><button type="button" class="btn-secondary" id="cancelNew">Cancelar</button><button class="btn-primary" type="submit">Continuar</button></div></form>`);
 $('#cancelNew').onclick=closeModal;
 let nameSearchTimer, searchController, searchSequence=0;
 $('#newPlaceName').addEventListener('input',()=>{
  clearTimeout(nameSearchTimer);searchController?.abort();const seq=++searchSequence;
  const q=$('#newPlaceName').value.trim(), target=$('#placeSuggestions');
  if(q.length<3){target.innerHTML='';return}
  target.innerHTML='<small class="helper-text">Buscando restaurantes…</small>';
  nameSearchTimer=setTimeout(async()=>{
   searchController=new AbortController();
   const params=new URLSearchParams({q,limit:'6',lang:'pt'});
   const pos=userLocation || (map? {lat:map.getCenter().lat,lng:map.getCenter().lng}:null);
   if(pos){params.set('lat',pos.lat);params.set('lon',pos.lng)}
   try{
    const response=await fetch('https://photon.komoot.io/api/?'+params,{signal:searchController.signal});
    if(!response.ok)throw new Error('Busca indisponível');
    const payload=await response.json();if(seq!==searchSequence)return;
    const results=(payload.features||[]).filter(f=>f.geometry?.coordinates?.length===2 && f.properties?.name);
    target.innerHTML=results.length?results.map((f,i)=>{
     const v=f.properties;const address=[v.street&&[v.street,v.housenumber].filter(Boolean).join(', '),v.district||v.city,v.state,v.country].filter(Boolean).join(' · ');
     return `<button type="button" class="search-result suggestion" data-suggestion="${i}"><strong>${escapeHtml(v.name)}</strong><small>${escapeHtml(address||'Local identificado no mapa')}</small></button>`
    }).join(''):'<small class="helper-text">Não encontrado. Você pode preencher o endereço manualmente.</small>';
    target.querySelectorAll('[data-suggestion]').forEach(btn=>btn.onclick=()=>{
     const f=results[Number(btn.dataset.suggestion)],v=f.properties;
     chosen={lat:Number(f.geometry.coordinates[1]),lng:Number(f.geometry.coordinates[0])};
     $('#newPlaceName').value=v.name.slice(0,100);
     $('#newPlaceAddress').value=[v.street&&[v.street,v.housenumber].filter(Boolean).join(', '),v.district||v.city,v.state,v.country].filter(Boolean).join(', ').slice(0,180) || v.name;
     $('#selectedCoordinates').textContent='✓ Restaurante localizado. Confira o endereço antes de salvar.';
     target.innerHTML='';$('#geocodeOptions').innerHTML='';
    });
   }catch(err){if(err.name!=='AbortError'&&seq===searchSequence)target.innerHTML='<small class="helper-text">Busca indisponível. Informe o endereço manualmente.</small>'}
  },700)
 });
 $('#newPlaceAddress').addEventListener('input',()=>{chosen=null;$('#selectedCoordinates').textContent='Selecione um resultado da busca para confirmar a localização.'});
 $('#verifyAddress').onclick=async()=>{
  const query=$('#newPlaceAddress').value.trim();if(query.length<5){toast('Digite um endereço mais completo.');return}
  const b=$('#verifyAddress');b.disabled=true;b.textContent='Localizando...';
  try{const found=await geocodeAddress(query);$('#geocodeOptions').innerHTML=found.length?found.map((p,i)=>`<button type="button" class="search-result" data-geocode="${i}">${escapeHtml(p.display_name)}</button>`).join(''):'<p class="helper-text">Nenhum endereço encontrado. Inclua número e cidade ou selecione o local no mapa.</p>';
  $('#geocodeOptions').querySelectorAll('[data-geocode]').forEach(button=>button.onclick=()=>{const p=found[Number(button.dataset.geocode)];chosen={lat:Number(p.lat),lng:Number(p.lon)};$('#newPlaceAddress').value=p.display_name.slice(0,180);$('#selectedCoordinates').textContent='✓ Localização confirmada no mapa';$('#geocodeOptions').innerHTML='';});
  }catch(err){toast(err.message)}finally{b.disabled=false;b.textContent='Buscar endereço no mapa'}
 };
 $('#newPlaceForm').onsubmit=e=>{e.preventDefault();if(!chosen){toast('Confirme o endereço para posicionar o restaurante corretamente.');return}const name=$('#newPlaceName').value.trim(),address=$('#newPlaceAddress').value.trim();closeModal();goToPoint(chosen.lat,chosen.lng,16);openReview({id:null,name,address,lat:chosen.lat,lng:chosen.lng})};
}
function openReview(r){
 if(live&&!user){openAuth();return}
 const old=r.id?reviewByMe(r.id):null;let rating=old?Number(old.rating):0;
 const ordered=old?.ordered_item||'',highlights=old?.highlights||(old?.note||''),returnAgain=old?.would_return||'',bill=old?.bill_amount??'';
 modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> AVALIAÇÃO</div><h2>Como foi no ${escapeHtml(r.name)}?</h2>
 <form id="reviewForm"><div class="field"><label>Sua nota</label><div class="rating-picker" id="ratingPicker">${[1,2,3,4,5].map(v=>`<button type="button" class="rating-star ${v<=Math.ceil(rating)?'selected':''}" data-rating="${v}" aria-label="${v} estrelas">★</button>`).join('')}<span class="rating-value" id="ratingValue">${rating?rating.toFixed(1).replace('.',',')+' / 5,0':'Escolha uma nota'}</span></div><small class="helper-text">Toque novamente para meia estrela.</small></div>
 <div class="field"><label for="reviewOrdered">O que você pediu? <span class="optional">opcional</span></label><textarea id="reviewOrdered" class="form-textarea compact-textarea" maxlength="300" placeholder="Pratos, bebidas, sobremesas…">${escapeHtml(ordered)}</textarea></div>
 <div class="field"><label for="reviewHighlights">O que valeu a pena? <span class="optional">opcional</span></label><textarea id="reviewHighlights" class="form-textarea compact-textarea" maxlength="500" placeholder="O que mais gostou?">${escapeHtml(highlights)}</textarea></div>
 <div class="field"><label for="reviewReturn">Voltaria? <span class="optional">opcional</span></label><select id="reviewReturn" class="form-input"><option value="">Não informado</option><option value="Sim" ${returnAgain==='Sim'?'selected':''}>Sim</option><option value="Talvez" ${returnAgain==='Talvez'?'selected':''}>Talvez</option><option value="Não" ${returnAgain==='Não'?'selected':''}>Não</option></select></div>
 <div class="field"><label for="reviewBill">Valor total da conta (R$) <span class="optional">opcional</span></label><input id="reviewBill" class="form-input" type="text" inputmode="decimal" maxlength="12" placeholder="Ex.: 120,50" value="${bill===''?'':escapeHtml(Number(bill).toFixed(2).replace('.',','))}"/><small class="helper-text">Valor total pago, não por pessoa.</small></div>
 <div class="form-actions"><button type="button" class="btn-secondary" id="cancelReview">Cancelar</button><button class="btn-primary" type="submit">Salvar avaliação</button></div></form>`);
 $('#cancelReview').onclick=closeModal;
 $('#ratingPicker').addEventListener('click',e=>{const b=e.target.closest('[data-rating]');if(!b)return;const v=Number(b.dataset.rating);rating=(rating===v)?v-.5:v;document.querySelectorAll('.rating-star').forEach((star,i)=>star.classList.toggle('selected',i<Math.ceil(rating)));$('#ratingValue').textContent=rating.toFixed(1).replace('.',',')+' / 5,0'});
 $('#reviewForm').onsubmit=async e=>{e.preventDefault();if(!rating){toast('Escolha uma nota de 0,5 a 5 estrelas.');return}
  const raw=$('#reviewBill').value.trim();const normalized=raw.replace(/\s|R\$/gi,'').replace(/\./g,'').replace(',','.');const amount=raw?Number(normalized):null;
  if(raw&&(!Number.isFinite(amount)||amount<0||amount>9999999.99)){toast('Informe um valor válido em reais.');return}
  const details={ordered_item:$('#reviewOrdered').value.trim(),highlights:$('#reviewHighlights').value.trim(),would_return:$('#reviewReturn').value,bill_amount:amount};
  const button=e.target.querySelector('[type=submit]');button.disabled=true;
  try{await saveReview(r,rating,details);closeModal();toast('Avaliação salva!');render()}catch(error){console.error(error);toast('Não foi possível salvar: '+(error.message||error))}finally{button.disabled=false}
 };
}
async function saveReview(r,rating,details){
 let rid=r.id;
 // O resumo legível é mantido para compatibilidade com versões anteriores.
 const note=[details.ordered_item&&`Pedi: ${details.ordered_item}`,details.highlights&&`Destaques: ${details.highlights}`,details.would_return&&`Voltaria: ${details.would_return}`,details.bill_amount!=null&&`Conta: ${moneyBR(details.bill_amount)}`].filter(Boolean).join(' · ').slice(0,500);
 if(live){
  if(!user)throw new Error('Faça login para continuar.');
  if(!rid){const {data,error}=await supabase.from('restaurants').insert({name:r.name,address:r.address||'',lat:r.lat,lng:r.lng,created_by:user.id}).select('id').single();if(error)throw error;rid=data.id}
  const {error}=await supabase.from('reviews').upsert({user_id:user.id,restaurant_id:rid,rating,note,...details},{onConflict:'user_id,restaurant_id'});if(error)throw error;await loadLiveData();
 }else{
  if(!rid){rid=randomId();demoData.restaurants.push({...r,id:rid,created_at:new Date().toISOString()})}
  const prev=demoData.reviews.find(v=>v.user_id==='demo-me'&&v.restaurant_id===rid);
  if(prev)Object.assign(prev,{rating,note,...details,created_at:new Date().toISOString()});
  else demoData.reviews.push({id:randomId(),user_id:'demo-me',restaurant_id:rid,rating,note,...details,created_at:new Date().toISOString()});
  persistDemo();loadDemo();
 }
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
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);live=true;$('#appStatus').textContent='Conectado ao Supabase';supabase.auth.onAuthStateChange((event,session)=>{user=session?.user||null;setTimeout(()=>{loadLiveData().catch(err=>toast(err.message));if(event==='PASSWORD_RECOVERY')openSetPassword()},0)});const {data:{session}}=await supabase.auth.getSession();user=session?.user||null;await loadLiveData();if(!user)openAuth()}catch(err){console.error(err);live=false;toast('Falha de conexão. Abrindo demonstração.');loadDemo()}
}
async function loadLiveData(){
 if(!user){restaurants=[];reviews=[];friends=[];profiles={};profile=null;render();return}
 const results=await Promise.all([supabase.from('profiles').select('*').eq('id',user.id).single(),supabase.from('friendships').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),supabase.from('reviews').select('*').order('created_at',{ascending:false}),supabase.from('restaurants').select('*')]);
 for(const r of results){if(r.error && r.error.code!=='PGRST116')throw r.error}
 profile=results[0].data;friends=results[1].data||[];reviews=results[2].data||[];restaurants=results[3].data||[];
 const ids=[...new Set(friends.map(f=>f.sender_id===user.id?f.recipient_id:f.sender_id).concat(reviews.map(r=>r.user_id)).filter(id=>id!==user.id))];profiles={};if(ids.length){const {data,error}=await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id',ids);if(error)throw error;for(const p of data||[])profiles[p.id]=p}
 render();
}
function openAuth(){
 if(!live)return;let mode='login';
 const paint=()=>{
  modal(`<div class="eyebrow"><span class="eyebrow-dot"></span> ACESSO</div><h2>${mode==='reset'?'Recuperar senha':'Entrar ou criar conta'}</h2>
  ${mode==='reset'?'<p>Enviaremos um link para você definir uma nova senha.</p>':'<p>Suas avaliações ficam salvas na sua conta.</p>'}
  ${mode!=='reset'?`<div class="auth-toggle"><button id="tabLogin" class="${mode==='login'?'active':''}">Entrar</button><button id="tabSignup" class="${mode==='signup'?'active':''}">Criar conta</button></div>`:''}
  <form id="authForm">${mode==='signup'?`<div class="field"><label>Nome exibido</label><input required class="form-input" id="authName" maxlength="50"/></div><div class="field"><label>Nome de usuário</label><input required pattern="[a-zA-Z0-9_]{3,30}" class="form-input" id="authUsername" maxlength="30"/></div>`:''}
  <div class="field"><label>E-mail</label><input required type="email" class="form-input" id="authEmail" placeholder="voce@email.com" autocomplete="email"/></div>
  ${mode!=='reset'?`<div class="field"><label>Senha</label><input required type="password" minlength="6" class="form-input" id="authPassword" autocomplete="${mode==='login'?'current-password':'new-password'}"/></div>`:''}
  <div class="form-actions"><button class="btn-primary" type="submit">${mode==='reset'?'Enviar link':'Continuar'}</button></div></form>
  <div class="auth-links">${mode==='login'?'<button type="button" id="forgotPassword">Esqueci minha senha</button>':mode==='reset'?'<button type="button" id="backToLogin">Voltar ao login</button>':'<small class="helper-text">Talvez seja necessário confirmar o e-mail.</small>'}</div>`);
  if(mode!=='reset'){$('#tabLogin').onclick=()=>{mode='login';paint()};$('#tabSignup').onclick=()=>{mode='signup';paint()}}
  if(mode==='login')$('#forgotPassword').onclick=()=>{mode='reset';paint()};
  if(mode==='reset')$('#backToLogin').onclick=()=>{mode='login';paint()};
  $('#authForm').onsubmit=async e=>{
   e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;
   const email=$('#authEmail').value.trim();const password=$('#authPassword')?.value;
   try{
    if(mode==='reset'){
     const redirectTo=location.origin+location.pathname;
     const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});if(error)throw error;
     closeModal();toast('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
    }else if(mode==='signup'){
     const username=$('#authUsername').value.trim().toLowerCase(),displayName=$('#authName').value.trim();
     const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username,display_name:displayName}}});if(error)throw error;
     closeModal();toast(data.session?'Conta criada!':'Confira o e-mail para confirmar seu cadastro.');
    }else{
     const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;closeModal();toast('Login realizado.');
    }
   }catch(err){toast(err.message||'Não foi possível continuar.')}finally{btn.disabled=false}
  };
 };paint();
}
function openSetPassword(){
 modal(`<h2>Definir nova senha</h2><p>Escolha uma senha nova para sua conta.</p><form id="setPasswordForm"><div class="field"><label for="newPassword">Nova senha</label><input class="form-input" id="newPassword" type="password" autocomplete="new-password" minlength="8" required/></div><div class="field"><label for="repeatPassword">Confirme a nova senha</label><input class="form-input" id="repeatPassword" type="password" autocomplete="new-password" minlength="8" required/></div><div class="form-actions"><button class="btn-primary" type="submit">Salvar nova senha</button></div></form>`);
 $('#setPasswordForm').onsubmit=async e=>{e.preventDefault();const pw=$('#newPassword').value;if(pw!==$('#repeatPassword').value){toast('As senhas não coincidem.');return}const btn=e.target.querySelector('[type=submit]');btn.disabled=true;try{const {error}=await supabase.auth.updateUser({password:pw});if(error)throw error;history.replaceState(null,'',location.pathname);closeModal();toast('Senha atualizada. Você já pode entrar com a nova senha.')}catch(err){toast(err.message)}finally{btn.disabled=false}};
}
async function uploadAvatar(file){
 if(!live||!user){toast('Entre na conta para adicionar uma foto.');return}
 if(!file?.type?.startsWith('image/')){toast('Selecione uma imagem.');return}
 if(file.size>12*1024*1024){toast('Escolha uma imagem de até 12 MB.');return}
 try{
  toast('Preparando sua foto…');
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,640/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw new Error('Formato de imagem não suportado pelo navegador.');
  const path=`${user.id}/avatar-${Date.now()}.jpg`;
  const {error:uploadError}=await supabase.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(uploadError)throw uploadError;
  const {data}=supabase.storage.from('avatars').getPublicUrl(path);
  const {error:updateError}=await supabase.from('profiles').update({avatar_url:data.publicUrl}).eq('id',user.id);if(updateError)throw updateError;
  await loadLiveData();toast('Foto de perfil atualizada!');
 }catch(err){console.error(err);toast('Erro ao enviar foto: '+(err.message||err))}
}
async function addFriend(){if(!live){toast('Amizades reais precisam do Supabase configurado.');return}if(!user){openAuth();return}const username=$('#friendInput').value.trim().replace(/^@/,'').toLowerCase();if(!username){toast('Digite um nome de usuário.');return}if(username===profile?.username){toast('Você já está no seu próprio mapa!');return}try{const {data:person,error}=await supabase.from('profiles').select('id,username,display_name').eq('username',username).maybeSingle();if(error)throw error;if(!person){toast('Usuário não encontrado.');return}if(friends.some(f=>[f.sender_id,f.recipient_id].includes(person.id))){toast('Vocês já têm uma solicitação ou amizade.');return}const {error:err}=await supabase.from('friendships').insert({sender_id:user.id,recipient_id:person.id});if(err)throw err;$('#friendInput').value='';await loadLiveData();toast('Pedido de amizade enviado!')}catch(err){toast(err.message||'Não foi possível enviar o convite.')}}
async function acceptFriend(id){try{const {error}=await supabase.from('friendships').update({status:'accepted'}).eq('id',id).eq('recipient_id',user.id);if(error)throw error;await loadLiveData();toast('Agora vocês são amigos!')}catch(err){toast(err.message)}}
initializeMap();initializeBackend();
const avatarInput=document.createElement('input');avatarInput.type='file';avatarInput.id='avatarFileInput';avatarInput.accept='image/*';avatarInput.hidden=true;avatarInput.addEventListener('change',e=>{if(e.target.files?.[0])uploadAvatar(e.target.files[0]);e.target.value=''});document.body.append(avatarInput);
document.addEventListener('click',e=>{
 const delPlace=e.target.closest('[data-delete-place]');if(delPlace){deletePlace(delPlace.dataset.deletePlace);return}
 const editPlaceBtn=e.target.closest('[data-edit-place]');if(editPlaceBtn){editPlace(editPlaceBtn.dataset.editPlace);return}
 const del=e.target.closest('[data-delete-review]');if(del){deleteReview(del.dataset.deleteReview);return}
 const edit=e.target.closest('[data-edit-review]');if(edit){const r=getRestaurant(edit.dataset.editReview);if(r)openReview(r);return}
 const link=e.target.closest('[data-open-place]');if(link){e.preventDefault();openPlace(link.dataset.openPlace);return}
 const accepted=e.target.closest('[data-accept]');if(accepted){acceptFriend(accepted.dataset.accept);return}
 if(e.target.closest('#loginButton'))openAuth();
 if(e.target.closest('#changePhotoButton'))$('#avatarFileInput').click();
 if(e.target.closest('#logoutButton'))supabase.auth.signOut().then(()=>{toast('Você saiu da conta.');switchPage('explore')});
 if(e.target.closest('#editDemoName')){const name=prompt('Como você gostaria de aparecer?',demoData.name);if(name?.trim()){demoData.name=name.trim().slice(0,50);persistDemo();loadDemo()}}
});
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
document.querySelectorAll('[data-feed-filter]').forEach(b=>b.addEventListener('click',()=>{feedFilter=b.dataset.feedFilter;document.querySelectorAll('[data-feed-filter]').forEach(x=>x.classList.toggle('active',x===b));renderFeed()}));
$('#sortButton').onclick=()=>{sortLatest=!sortLatest;$('#sortButton').textContent=sortLatest?'Mais recentes ↓':'Nome A–Z ↓';renderRestaurants()};
$('#addPlaceSide').onclick=()=>openNewPlace();$('#floatingAdd').onclick=()=>openNewPlace();
$('#addFriendButton').onclick=addFriend;
$('#friendInput').addEventListener('keydown',e=>{if(e.key==='Enter')addFriend()});
$('#locateButton').onclick=()=>locateUser(false);
$('#resetMapButton').onclick=fitAll;
window.addEventListener('resize',mapResize);
