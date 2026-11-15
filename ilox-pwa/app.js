const views=["inicio","inventario","amigos","construir","opciones","explorar"];
const titles={inicio:["BIENVENIDO A ILOX","Tu mundo te espera."],inventario:["TU MOCHILA","Inventario"],amigos:["AVENTURAS COMPARTIDAS","Amigos"],construir:["TU MUNDO, TUS REGLAS","Construí a tu manera."],opciones:["PREFERENCIAS","Opciones"],explorar:["PRIMER DESTINO","Valle del Bosque"]};
const toast=document.querySelector("#toast");
let installPrompt=null;
function notify(message){toast.textContent=message;toast.classList.add("show");window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>toast.classList.remove("show"),2400)}
function showView(name){
 if(!views.includes(name))return;
 document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id===`view-${name}`));
 document.querySelectorAll("[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===name));
 document.querySelector("#section-kicker").textContent=titles[name][0];
 document.querySelector("#section-title").textContent=titles[name][1];
 history.replaceState(null,"",name==="inicio"?"#inicio":`#${name}`);
 window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>showView(button.dataset.view)));
document.querySelector("#reduced-motion").addEventListener("change",event=>{
 document.documentElement.classList.toggle("reduce-motion",event.target.checked);
 localStorage.setItem("ilox-reduced-motion",String(event.target.checked));
});
const savedMotion=localStorage.getItem("ilox-reduced-motion")==="true";
document.querySelector("#reduced-motion").checked=savedMotion;
document.documentElement.classList.toggle("reduce-motion",savedMotion);
document.querySelector("#fullscreen").addEventListener("click",async()=>{
 try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{notify("El navegador no permitió activar pantalla completa.");}
});
window.addEventListener("beforeinstallprompt",event=>{event.preventDefault();installPrompt=event;const button=document.querySelector("#install");button.disabled=false;button.textContent="INSTALAR"});
document.querySelector("#install").addEventListener("click",async()=>{
 if(!installPrompt){notify("En tu navegador, abrí el menú y elegí “Instalar aplicación” o “Agregar a pantalla de inicio”.");return;}
 installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;
});
if("serviceWorker" in navigator && location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(error=>console.warn("ILOX: service worker no disponible",error)));
const initial=location.hash.slice(1);showView(views.includes(initial)?initial:"inicio");
