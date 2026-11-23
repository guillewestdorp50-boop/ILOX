const $=s=>document.querySelector(s);
const sb=window.wvSupabase;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n||0));
const fmt=d=>d?new Date(d).toLocaleString('es-AR'):'—';
const labels={libre:'LIBRE',viaje:'EN VIAJE',cargando:'CARGANDO',cargado:'CARGADO',descargando:'DESCARGANDO',demorado:'DEMORADO',accidente:'ACCIDENTE',deposito:'EN DEPÓSITO',planta:'EN PLANTA',base:'EN BASE',casa:'EN CASA',descansando:'DESCANSANDO',cafe:'PARADA / CAFÉ',ypf:'YPF',repostando:'REPOSTANDO',otro:'OTRO'};
let activePage='inicio',poll=null,adminProfile=null,messageFeed=null,adminChatTarget='',cache={drivers:[],passengers:[],requests:[],trips:[],statuses:[],messages:[]};
function toast(t){const x=$('#toast');if(!x)return;x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),3000)}
function page(title,html){$('#page-title').textContent=title;$('#page-subtitle').textContent='Centro de operaciones · WEST-VILL';$('#crumb').textContent=title;$('#page-content').innerHTML=html}
function empty(t){return '<div class="empty"><div class="empty-icon">⌁</div><strong>'+esc(t)+'</strong></div>'}
function panel(title,body,extra=''){return '<section class="panel"><div class="panel-head"><h2>'+title+'</h2>'+extra+'</div>'+body+'</section>'}
function nav(){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{loadPage(b.dataset.page);closeSidebar();});
 const menu=$('#menu-btn'),side=$('#sidebar');
 if(menu){menu.setAttribute('aria-expanded','false');menu.onclick=()=>{const open=side.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');};}
 document.querySelectorAll('[data-profile-close]').forEach(b=>b.onclick=closeProfile);
 $('#admin-profile-open')?.addEventListener('click',openProfile);
}
function closeSidebar(){const s=$('#sidebar');s?.classList.remove('open');$('#menu-btn')?.setAttribute('aria-expanded','false');}
function openProfile(){if(!adminProfile)return;let m=$('#wv-profile-modal');if(!m){m=document.createElement('div');m.id='wv-profile-modal';m.className='invite-modal';m.innerHTML='<section class="invite-card" role="dialog" aria-modal="true" aria-labelledby="profile-title"><button class="modal-close" data-profile-close aria-label="Cerrar">×</button><h2 id="profile-title">Perfil de administración</h2><div id="wv-profile-content"></div><button class="btn secondary" data-profile-close>Cerrar</button></section>';document.body.append(m);m.addEventListener('click',e=>{if(e.target===m)closeProfile();});m.querySelectorAll('[data-profile-close]').forEach(b=>b.onclick=closeProfile);}$('#wv-profile-content').innerHTML='<p><b>Nombre:</b> '+esc(adminProfile.display_name)+'</p><p><b>Usuario:</b> '+esc(adminProfile.username)+'</p><p><b>Rol:</b> ADMINISTRACIÓN</p><p class="muted">Cuenta central de WEST-VILL</p>';m.hidden=false;}
function closeProfile(){const m=$('#wv-profile-modal');if(m)m.hidden=true;}
async function rows(table,select='*',order='created_at'){const q=sb.from(table).select(select);if(order)q.order(order,{ascending:false});const {data,error}=await q.limit(500);if(error)throw error;return data||[]}
async function loadPeople(){const all=await rows('westvill_profiles','id,username,display_name,role,is_available,created_at','created_at');cache.drivers=all.filter(x=>x.role==='conductor');cache.passengers=all.filter(x=>x.role==='pasajero');$('#driver-badge').textContent=cache.drivers.length;return all}
async function loadStatuses(){const s=await rows('westvill_driver_status','driver_id,status,location_label,notes,created_at','created_at');const seen=new Set();cache.statuses=s.filter(x=>{if(seen.has(x.driver_id))return false;seen.add(x.driver_id);return true;});}
async function loadRequests(){cache.requests=await rows('westvill_requests','*','created_at');$('#request-badge').textContent=cache.requests.filter(x=>x.status==='pendiente').length;}
async function checkUnansweredTrips(){
 if(!adminProfile?.id)return;
 const cutoff=new Date(Date.now()-5*60*1000).toISOString();
 const {data,error}=await sb.from('westvill_trips').select('id,passenger_id,driver_id,origin,destination,assigned_at').eq('driver_response','pendiente').is('admin_wait_alerted_at',null).lte('assigned_at',cutoff).limit(50);
 if(error)return;
 for(const trip of data||[]){
  const {data:marked,error:markError}=await sb.from('westvill_trips').update({admin_wait_alerted_at:new Date().toISOString()}).eq('id',trip.id).is('admin_wait_alerted_at',null).select('id').maybeSingle();
  if(markError||!marked)continue;
  const {error:noticeError}=await sb.from('westvill_notifications').insert({user_id:adminProfile.id,title:'Viaje esperando confirmación',body:'El conductor todavía no respondió después de 5 minutos: '+trip.origin+' → '+trip.destination+'. Podés reasignarlo o contactar al pasajero.',kind:'trip_waiting',trip_id:trip.id});
  if(!noticeError)toast('ALERTA: hay un viaje esperando confirmación hace 5 minutos.');
 }
}
function personName(id){return [...cache.drivers,...cache.passengers].find(p=>p.id===id)?.display_name||'Cuenta';}
function driverList(filter='all'){const list=filter==='available'?cache.drivers.filter(d=>d.is_available):filter==='unavailable'?cache.drivers.filter(d=>!d.is_available):cache.drivers;return list.map(d=>{const s=cache.statuses.find(x=>x.driver_id===d.id);return '<tr><td><button class="text-action" data-person="'+d.id+'">'+esc(d.display_name)+'</button></td><td>'+esc(d.username)+'</td><td><span class="tag '+(d.is_available?'good':'')+'">'+(d.is_available?'DISPONIBLE':'NO DISPONIBLE')+'</span></td><td><b>'+esc(s?labels[s.status]||s.status:'SIN INFORMAR')+'</b>'+(s?.location_label?'<div class="muted">'+esc(s.location_label)+'</div>':'')+'</td><td>'+fmt(s?.created_at)+'</td></tr>';}).join('')||'<tr><td colspan="5">No hay conductores en esta lista.</td></tr>'}
function table(headers,body){return '<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+body+'</tbody></table></div>'}
async function loadPage(which){
 activePage=which;document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===which));
 try{
 await loadPeople();
 if(['inicio','conductores'].includes(which))await loadStatuses();
 if(['inicio','solicitudes','anulados'].includes(which))await loadRequests();
 if(which==='inicio'){
 const free=cache.drivers.filter(x=>x.is_available).length;
 page('Centro de operaciones', '<div class="metrics"><button class="metric metric-link" data-go="conductores" data-filter="all"><div class="metric-top">CONDUCTORES REGISTRADOS</div><div class="metric-value">'+cache.drivers.length+'</div><div class="metric-note">Abrir padrón completo</div></button><button class="metric metric-link" data-go="conductores" data-filter="available"><div class="metric-top">CONDUCTORES DISPONIBLES</div><div class="metric-value">'+free+'</div><div class="metric-note">Tocar para ver la lista</div></button><button class="metric metric-link" data-go="clientes"><div class="metric-top">PASAJEROS REGISTRADOS</div><div class="metric-value">'+cache.passengers.length+'</div><div class="metric-note">Abrir padrón de pasajeros</div></button><button class="metric metric-link" data-go="solicitudes"><div class="metric-top">SOLICITUDES PENDIENTES</div><div class="metric-value">'+cache.requests.filter(x=>x.status==='pendiente').length+'</div><div class="metric-note">Abrir bandeja de solicitudes</div></button></div>'+panel('Accesos directos','<div class="btn-row"><button class="btn" data-go="conductores">Ver conductores y estados</button><button class="btn secondary" data-go="clientes">Ver pasajeros</button><button class="btn secondary" data-go="solicitudes">Administrar solicitudes</button><button class="btn secondary" data-go="viajes">Ver viajes</button></div>'));
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{window.wvDriverFilter=b.dataset.filter||'all';loadPage(b.dataset.go)});
 }else if(which==='conductores'){
 const filter=window.wvDriverFilter||'all';window.wvDriverFilter='all';
 page('Conductores',panel('Padrón de conductores','<div class="btn-row filter-row"><button class="btn secondary" data-filter="all">Todos ('+cache.drivers.length+')</button><button class="btn" data-filter="available">Disponibles ('+cache.drivers.filter(x=>x.is_available).length+')</button><button class="btn secondary" data-filter="unavailable">No disponibles ('+cache.drivers.filter(x=>!x.is_available).length+')</button></div><div id="driver-table">'+table(['CONDUCTOR','USUARIO','DISPONIBILIDAD','ESTADO DEL PAD','ÚLTIMO AVISO'],driverList(filter))+'</div><p class="muted">El estado del PAD y la disponibilidad se actualizan mientras esta sección está abierta. Tocá un nombre para ver su ficha.</p>'));
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{$('#driver-table').innerHTML=table(['CONDUCTOR','USUARIO','DISPONIBILIDAD','ESTADO DEL PAD','ÚLTIMO AVISO'],driverList(b.dataset.filter));document.querySelectorAll('[data-person]').forEach(x=>x.onclick=()=>showPerson(x.dataset.person));});
 document.querySelectorAll('[data-person]').forEach(x=>x.onclick=()=>showPerson(x.dataset.person));
 }else if(which==='clientes'){
 page('Pasajeros registrados',panel('Padrón completo de pasajeros',cache.passengers.length?table(['PASAJERO','USUARIO','ALTA','CUENTA'],cache.passengers.map(p=>'<tr><td><button class="text-action" data-person="'+p.id+'">'+esc(p.display_name)+'</button></td><td>'+esc(p.username)+'</td><td>'+fmt(p.created_at)+'</td><td><span class="tag good">REGISTRADO</span></td></tr>').join('')):empty('Todavía no hay pasajeros registrados.'))+'<p class="muted">La lista se alimenta automáticamente cada vez que una persona crea su cuenta de pasajero.</p>');
 document.querySelectorAll('[data-person]').forEach(x=>x.onclick=()=>showPerson(x.dataset.person));
 }else if(which==='solicitudes'){
 const names=Object.fromEntries(cache.passengers.map(p=>[p.id,p.display_name]));
   const activeRequests=cache.requests.filter(r=>r.admin_decision!=='rechazado'&&!['cancelada','cancelado','anulada','anulado'].includes(r.status));
   const reqHtml=activeRequests.map(r=>{const who=cache.passengers.find(p=>p.id===r.passenger_id)?.display_name||'Pasajero';const info='<p>'+fmt(r.travel_at)+' · '+r.passengers+' pasajero(s) · '+esc(r.status)+'</p>'+(r.notes?'<p>'+esc(r.notes)+'</p>':'');const decisions=r.status==='pendiente'&&r.admin_decision!=='tomado'?'<div class="btn-row" style="margin:12px 0"><button class="btn" data-take="'+r.id+'">TOMAR EL VIAJE</button><button class="btn danger" data-reject="'+r.id+'">ANULAR VIAJE</button></div>':'<p class="muted">Estado: '+esc(r.status)+'</p>';const state=r.admin_decision==='tomado'?'<p class="muted" style="color:#20bd78">✓ ADMINISTRACIÓN TOMÓ EL VIAJE · '+fmt(r.admin_decided_at)+'</p>':r.admin_decision==='rechazado'?'<p class="muted" style="color:#e6b45c">Se informó al pasajero que debe esperar. '+(r.passenger_followup==='movil_conseguido'?'El pasajero ya consiguió móvil.':r.passenger_followup==='espero'?'El pasajero confirmó que espera.':'Esperando respuesta del pasajero.')+'</p>':'';const action=r.status==='pendiente'&&r.admin_decision==='tomado'&&['sin_cotizar','consulta'].includes(r.quote_status)?'<form class="quote-form" data-quote="'+r.id+'" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px"><label>Distancia km<input name="km" type="number" min="0.1" step="0.1" required placeholder="Km"></label><label>Tiempo minutos<input name="minutes" type="number" min="1" step="1" required placeholder="Min"></label><label>Precio ARS<input name="price" type="number" min="1" step="1" required placeholder="$"></label><button class="btn" type="submit" style="grid-column:1/-1">Enviar cotización al pasajero</button></form>':(r.quote_status==='enviada'?'<p class="muted">Cotización enviada: '+r.quote_km+' km · '+r.quote_minutes+' min · '+money(r.quote_price)+' · esperando respuesta del pasajero.</p>':(r.quote_status==='aceptada'?'<p class="muted">Pasajero aceptó: '+r.quote_km+' km · '+r.quote_minutes+' min · '+money(r.quote_price)+'</p><div class="assign-row"><select id="driver-'+r.id+'"><option value="">Elegir conductor disponible</option>'+cache.drivers.filter(d=>d.is_available).map(d=>'<option value="'+d.id+'">'+esc(d.display_name)+'</option>').join('')+'</select><button class="btn" data-assign="'+r.id+'">Asignar viaje</button></div>':(r.quote_status==='consulta'?'<p class="muted">El pasajero pidió consultar por chat antes de decidir.</p>':(r.quote_status==='pausada'?'<p class="muted">El pasajero indicó: por ahora no.</p>':(r.assigned_driver_id?'<p class="muted">Conductor asignado: '+esc(personName(r.assigned_driver_id))+'</p>':'')))));return panel(esc(who)+' · '+esc(r.origin)+' → '+esc(r.destination),info+state+decisions+action);}).join('');
  page('Solicitudes de pasajeros',reqHtml||panel('Bandeja vacía',empty('Todavía no llegaron solicitudes.')));
   document.querySelectorAll('[data-quote]').forEach(form=>form.onsubmit=async e=>{e.preventDefault();const fd=new FormData(form);const km=Number(fd.get('km')),minutes=Number(fd.get('minutes')),price=Number(fd.get('price'));if(!(km>0&&minutes>0&&price>0)){toast('Completá km, minutos y precio.');return;}const id=form.dataset.quote;const {error}=await sb.from('westvill_requests').update({quote_km:km,quote_minutes:minutes,quote_price:price,quote_status:'enviada',updated_at:new Date().toISOString()}).eq('id',id).eq('status','pendiente');if(error){toast('No se pudo enviar la cotización: '+error.message);return;}const req=cache.requests.find(x=>x.id===id);if(req)await sb.from('westvill_notifications').insert({user_id:req.passenger_id,title:'Tu viaje tiene una cotización',body:km+' km · '+minutes+' minutos · '+money(price),kind:'quote_ready'});toast('Cotización enviada al pasajero.');loadPage('solicitudes');});
  document.querySelectorAll('[data-take]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.take,req=cache.requests.find(x=>x.id===id);if(!req)return;btn.disabled=true;const stamp=new Date().toISOString();const {data,error}=await sb.from('westvill_requests').update({admin_decision:'tomado',admin_decided_at:stamp,received_at:req.received_at||stamp,updated_at:stamp}).eq('id',id).eq('status','pendiente').select('id').maybeSingle();if(error||!data){toast('No se pudo tomar el viaje: '+(error?.message||'Actualizá la bandeja.'));btn.disabled=false;return;}adminChatTarget=req.passenger_id;await sb.from('westvill_messages').insert({sender_id:adminProfile.id,recipient_id:req.passenger_id,body:'Hola, tomamos tu solicitud de viaje. Podemos coordinar por acá el tiempo de espera, la llegada del conductor y cualquier detalle que necesites.'});await sb.from('westvill_notifications').insert({user_id:req.passenger_id,title:'Administración tomó tu viaje',body:'Ya estamos coordinando tu solicitud. Podés hablar directamente con Administración desde el chat de WEST-VILL.',kind:'request_taken'});toast('Viaje tomado. Abriendo chat con '+personName(req.passenger_id)+'.');loadPage('mensajes');});
  document.querySelectorAll('[data-reject]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.reject,req=cache.requests.find(x=>x.id===id);if(!req)return;btn.disabled=true;const stamp=new Date().toISOString();const {data,error}=await sb.from('westvill_requests').update({admin_decision:'rechazado',admin_decided_at:stamp,received_at:req.received_at||stamp,passenger_followup:'ninguna',updated_at:stamp}).eq('id',id).eq('status','pendiente').select('id').maybeSingle();if(error||!data){toast('No se pudo rechazar el viaje: '+(error?.message||'Actualizá la bandeja.'));btn.disabled=false;return;}const body='En este momento todos nuestros conductores se encuentran en viaje. Te vamos a volver a escribir en unos minutos. No necesitás solicitar el viaje nuevamente.';const {error:noticeError}=await sb.from('westvill_notifications').insert({user_id:req.passenger_id,title:'Demora en la disponibilidad de móviles',body,kind:'request_unavailable'});toast(noticeError?'Solicitud actualizada, pero no se pudo enviar la notificación.':'Aviso enviado al pasajero.');loadPage('solicitudes');});
 document.querySelectorAll('[data-assign]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
     const requestId=btn.dataset.assign;
     const select=$('#driver-'+requestId);
     if(!select?.value){toast('Primero elegí a Guille W u otro conductor disponible.');return;}
     await assign(requestId);
    });
   });
 }else if(which==='anulados'){
 const canceled=cache.requests.filter(r=>r.admin_decision==='rechazado'||['cancelada','cancelado','anulada','anulado'].includes(r.status));
 const cards=canceled.map(r=>{const who=personName(r.passenger_id);const follow=r.passenger_followup==='movil_conseguido'?'El pasajero ya consiguió otro móvil.':r.passenger_followup==='espero'?'El pasajero confirmó que puede esperar.':'Sin respuesta del pasajero.';return '<section class="panel canceled-panel" style="border:1px solid #a93643"><div class="panel-head"><h2>'+esc(who)+' · '+esc(r.origin)+' → '+esc(r.destination)+'</h2><span class="tag danger">ANULADO</span></div><p>'+fmt(r.travel_at)+' · '+r.passengers+' pasajero(s)</p><p><b style="color:#ff7c87">ANULADO POR ADMINISTRACIÓN</b></p><p class="muted">'+follow+'</p><div class="btn-row"><button class="btn danger" data-open-canceled-chat="'+r.passenger_id+'">ABRIR CHAT</button></div></section>';}).join('');
 page('Anulados',cards||panel('Sin viajes anulados',empty('Todavía no hay viajes anulados.')));
 document.querySelectorAll('[data-open-canceled-chat]').forEach(b=>b.onclick=()=>{adminChatTarget=b.dataset.openCanceledChat;loadPage('mensajes');});
 }else if(which==='viajes'){
 cache.trips=await rows('westvill_trips','*','created_at');
 const activeTrips=cache.trips.filter(t=>t.status!=='completado');
 page('Viajes',panel('Viajes en curso y programados',activeTrips.length?table(['ORIGEN','DESTINO','PASAJERO','CONDUCTOR','FECHA','ESTADO'],activeTrips.map(t=>'<tr><td>'+esc(t.origin)+'</td><td>'+esc(t.destination)+'</td><td>'+esc(personName(t.passenger_id))+'</td><td>'+esc(personName(t.driver_id))+'</td><td>'+fmt(t.travel_at)+'</td><td>'+esc(t.status)+'</td></tr>').join('')):empty('No hay viajes activos o programados.')));
 }else if(which==='completos'){
 cache.trips=await rows('westvill_trips','*','created_at');
 const completed=cache.trips.filter(t=>t.status==='completado');
 page('Viajes completos',panel('Historial de viajes completados','<div class="balance green">'+completed.length+' COMPLETADOS</div>'+(completed.length?table(['ORIGEN','DESTINO','PASAJERO','CONDUCTOR','FECHA','ESTADO'],completed.map(t=>'<tr><td>'+esc(t.origin)+'</td><td>'+esc(t.destination)+'</td><td>'+esc(personName(t.passenger_id))+'</td><td>'+esc(personName(t.driver_id))+'</td><td>'+fmt(t.finished_at||t.travel_at)+'</td><td><span class="tag good">✓ COMPLETADO</span></td></tr>').join('')):empty('Todavía no hay viajes completados.'))));
  }else if(which==='mensajes'){
  const ms=await rows('westvill_messages','*','created_at');
  const target=adminChatTarget||'';
  const thread=target?ms.filter(m=>(m.sender_id===adminProfile.id&&m.recipient_id===target)||(m.sender_id===target&&m.recipient_id===adminProfile.id)).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)):[];
  page('Mensajes',panel('Chat con pasajeros','<label class="field">Elegir pasajero<select id="admin-chat-person"><option value="">Seleccioná un pasajero</option>'+cache.passengers.map(p=>'<option value="'+p.id+'" '+(p.id===target?'selected':'')+'>'+esc(p.display_name)+'</option>').join('')+'</select></label><div id="admin-chat-log" class="client-chat-log" style="margin-top:12px;min-height:180px">'+(target?(thread.map(m=>'<article class="client-row"><b>'+(m.sender_id===adminProfile.id?'Administración':'Pasajero')+'</b><p>'+esc(m.body)+'</p><div class="muted">'+fmt(m.created_at)+'</div></article>').join('')||'<p class="muted">Todavía no hay mensajes. Escribí para iniciar la coordinación.</p>'):'Elegí un pasajero para abrir la conversación.')+'</div>'+(target?'<form id="admin-chat-form" class="client-chat-send" style="display:flex;gap:8px;margin-top:12px"><input name="body" placeholder="Escribí al pasajero…" maxlength="4000" required><button class="btn" type="submit">Enviar</button></form>':''))+'<p class="muted">Administración puede consultar todas las conversaciones y responder directamente al pasajero.</p>');
  $('#admin-chat-person').onchange=()=>{adminChatTarget=$('#admin-chat-person').value;loadPage('mensajes');};
  $('#admin-chat-form')?.addEventListener('submit',async e=>{e.preventDefault();const body=String(new FormData(e.currentTarget).get('body')||'').trim();if(!body||!adminChatTarget)return;const {error}=await sb.from('westvill_messages').insert({sender_id:adminProfile.id,recipient_id:adminChatTarget,body});if(error){toast('No se pudo enviar: '+error.message);return;}loadPage('mensajes');});

 const ms=await rows('westvill_messages','*','created_at');
 page('Mensajes',panel('Espejo de conversaciones','<p class="muted">Administración puede consultar todos los mensajes entre conductores y pasajeros. No hace falta aprobar ni habilitar cada conversación.</p>'+(ms.length?ms.slice(0,120).map(m=>'<article class="client-row"><b>'+esc(personName(m.sender_id))+' → '+esc(personName(m.recipient_id))+'</b><p>'+esc(m.body)+'</p><div class="muted">'+fmt(m.created_at)+'</div></article>').join(''):empty('Todavía no hay mensajes.'))));
 }else if(which==='ingresos'||which==='gastos'){
 const income=which==='ingresos',t=income?'westvill_income':'westvill_expenses',date=income?'received_at':'spent_at';
 const data=await rows(t,'*',date);const total=data.reduce((a,x)=>a+Number(x.amount||0),0);
 page(income?'Ingresos':'Gastos',panel(income?'Registrar ingreso':'Registrar gasto','<form id="ledger-form" class="form-grid"><label class="field">Descripción<input name="description" required maxlength="140"></label><label class="field">Importe<input name="amount" type="number" min="1" step="0.01" required></label><label class="field">Fecha<input name="date" type="date" required value="'+new Date().toISOString().slice(0,10)+'"></label><button class="btn" type="submit">Guardar '+(income?'ingreso':'gasto')+'</button></form>')+panel('Total registrado','<div class="balance">'+money(total)+'</div>')+panel('Movimientos',data.length?table(['DESCRIPCIÓN','IMPORTE','FECHA'],data.map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+money(x.amount)+'</td><td>'+fmt(x[date])+'</td></tr>').join('')):empty('No hay movimientos cargados.')));
 $('#ledger-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {error}=await sb.from(t).insert({description:fd.get('description'),amount:Number(fd.get('amount')),[date]:fd.get('date'),created_by:(await sb.auth.getUser()).data.user.id});if(error){toast('No se pudo guardar: '+error.message);return;}toast('Movimiento guardado.');loadPage(which);};
 }else if(which==='cuentas'){
 const inv=await rows('westvill_invites','id,role,max_uses,uses_count,expires_at,active,created_at','created_at');const pending=inv.filter(x=>x.active&&x.uses_count<x.max_uses&&(!x.expires_at||new Date(x.expires_at)>new Date()));
 page('Cuentas e invitaciones',panel('Cuentas registradas','<p>Conductores: <b>'+cache.drivers.length+'</b> · Pasajeros: <b>'+cache.passengers.length+'</b></p>')+panel('Invitaciones pendientes',pending.length?table(['TIPO','USOS','VENCIMIENTO','ESTADO'],pending.map(x=>'<tr><td>'+esc(x.role)+'</td><td>'+x.uses_count+' / '+x.max_uses+'</td><td>'+fmt(x.expires_at)+'</td><td><span class="tag good">ACTIVA</span></td></tr>').join('')):empty('No hay invitaciones pendientes.')));
 }else{page('Sección no disponible',panel('Sin contenido','Esta sección todavía no tiene una función habilitada.'));}
 }catch(e){page('Error al cargar '+esc(which),panel('No se pudo consultar la información','<p>'+esc(e.message)+'</p><button class="btn" id="retry-page">Reintentar</button>'));$('#retry-page').onclick=()=>loadPage(which);}
}
async function showPerson(id){const p=[...cache.drivers,...cache.passengers].find(x=>x.id===id);if(!p)return;let detail='<p><b>Nombre:</b> '+esc(p.display_name)+'</p><p><b>Usuario:</b> '+esc(p.username)+'</p><p><b>Tipo:</b> '+esc(p.role)+'</p><p><b>Alta:</b> '+fmt(p.created_at)+'</p>';if(p.role==='conductor'){const s=cache.statuses.find(x=>x.driver_id===id);detail+='<p><b>Disponibilidad:</b> '+(p.is_available?'Disponible':'No disponible')+'</p><p><b>Estado PAD:</b> '+esc(s?labels[s.status]||s.status:'Sin informar')+'</p><p><b>Último aviso:</b> '+fmt(s?.created_at)+'</p><p><b>Ubicación:</b> '+esc(s?.location_label||'No informada')+'</p>';}page('Ficha de '+esc(p.display_name),panel('Datos de la cuenta',detail,'<button class="btn secondary" id="back-list">Volver</button>'));$('#back-list').onclick=()=>loadPage(activePage);}
async function assign(id){
 const button=document.querySelector('[data-assign="'+id+'"]');
 const driverId=$('#driver-'+id)?.value;
 const driver=cache.drivers.find(d=>d.id===driverId);
 const req=cache.requests.find(r=>r.id===id);
 if(!driver||!req){toast('Elegí un conductor disponible.');return;}
 if(button){button.disabled=true;button.textContent='Asignando…';}
 try{
  const {data:trip,error:tripError}=await sb.from('westvill_trips').insert({
   request_id:req.id,passenger_id:req.passenger_id,driver_id:driver.id,
   origin:req.origin,destination:req.destination,travel_at:req.travel_at,
   fare:req.quote_price||0,quote_km:req.quote_km,quote_minutes:req.quote_minutes,status:'programado'
  }).select('id').single();
  if(tripError)throw new Error('No se pudo crear el viaje: '+tripError.message);
  const {data:updated,error:updateError}=await sb.from('westvill_requests').update({
   assigned_driver_id:driver.id,status:'aceptada',updated_at:new Date().toISOString()
  }).eq('id',req.id).eq('status','pendiente').select('id').maybeSingle();
  if(updateError||!updated){
   await sb.from('westvill_trips').delete().eq('id',trip.id);
   throw new Error(updateError?.message||'La solicitud ya no está pendiente. Actualizá la bandeja.');
  }
  const {error:noticeError}=await sb.from('westvill_notifications').insert({
   user_id:driver.id,title:'Nuevo viaje asignado',
   body:'Administración te asignó un viaje: '+req.origin+' → '+req.destination,
   kind:'trip_assigned',trip_id:trip.id
  });
  toast(noticeError?'Viaje asignado. Aviso guardado pendiente de notificación.':'Viaje asignado y notificación enviada a '+driver.display_name);
  await loadPage('solicitudes');
 }catch(e){toast(e.message||'No se pudo asignar el viaje.');if(button){button.disabled=false;button.textContent='Asignar viaje';}}
}

window.initAdminPanel=async function(profile){adminProfile=profile;nav();if(messageFeed)sb.removeChannel(messageFeed);messageFeed=sb.channel('westvill-admin-message-mirror').on('postgres_changes',{event:'INSERT',schema:'public',table:'westvill_messages'},()=>{if(activePage==='mensajes')loadPage('mensajes');}).subscribe();if(poll)clearInterval(poll);poll=setInterval(()=>{checkUnansweredTrips();if(activePage==='conductores'||activePage==='inicio'||activePage==='viajes'||activePage==='solicitudes'||activePage==='anulados'||activePage==='completos')loadPage(activePage);},10000);await checkUnansweredTrips();$('#admin-logout').onclick=async()=>{if(messageFeed)sb.removeChannel(messageFeed);await sb.auth.signOut();location.reload()};await loadPage('inicio');};
