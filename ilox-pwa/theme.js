(() => {
  const KEY='west-vill-theme';
  const root=document.documentElement;
  const buttons=()=>document.querySelectorAll('[data-theme-toggle]');
  function apply(mode){
    const day=mode==='day';
    document.body.classList.toggle('theme-day',day);
    root.style.colorScheme=day?'light':'dark';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=day?'#f3f6fa':'#101e35';
    buttons().forEach(button=>{
      button.textContent=day?'☾ Noche':'☀ Día';
      button.setAttribute('aria-label',day?'Activar modo nocturno':'Activar modo diurno');
      button.setAttribute('aria-pressed',String(day));
    });
  }
  let saved='night';
  try{saved=localStorage.getItem(KEY)||'night';}catch(e){}
  apply(saved);
  buttons().forEach(button=>button.addEventListener('click',()=>{
    const next=document.body.classList.contains('theme-day')?'night':'day';
    try{localStorage.setItem(KEY,next);}catch(e){}
    apply(next);
  }));
})();