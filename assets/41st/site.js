/* 41 Sales Team site: mobile menu and dropdowns. No dependencies. */
(function(){
  var h=document.querySelector('.site-header'); if(!h) return;
  var t=h.querySelector('.nav-toggle');
  if(t) t.addEventListener('click',function(){var o=h.classList.toggle('menu-open');t.setAttribute('aria-expanded',o?'true':'false');});
  h.querySelectorAll('.nav-dd>button').forEach(function(b){
    b.addEventListener('click',function(e){e.stopPropagation();var d=b.parentNode,o=!d.classList.contains('open');
      h.querySelectorAll('.nav-dd.open').forEach(function(x){x.classList.remove('open');x.firstElementChild.setAttribute('aria-expanded','false');});
      if(o){d.classList.add('open');b.setAttribute('aria-expanded','true');}});
  });
  document.addEventListener('click',function(){h.querySelectorAll('.nav-dd.open').forEach(function(x){x.classList.remove('open');x.firstElementChild.setAttribute('aria-expanded','false');});});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){h.classList.remove('menu-open');h.querySelectorAll('.nav-dd.open').forEach(function(x){x.classList.remove('open');});}});
})();
