// Adds copy behavior and toast notifications to bash code blocks.
// Place this file and include it in the <head> or before </body> with defer attribute.

(function(){
  function createToast(){
    let t = document.getElementById('copy-toast');
    if(t) return t;
    t = document.createElement('div');
    t.id = 'copy-toast';
    t.innerHTML = '<span class=\"icon\" aria-hidden=\"true\"></span><span class=\"msg\">Copied</span>';
    document.body.appendChild(t);
    return t;
  }

  function showToast(text){
    const toast = createToast();
    toast.querySelector('.msg').textContent = text || 'Copied to clipboard!';
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(()=> toast.classList.remove('show'), 2200);
  }

  function copyText(text){
    if(!navigator.clipboard){
      // fallback - older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { document.execCommand('copy'); showToast('Copied'); } catch(e){ showToast('Copy failed'); }
      document.body.removeChild(ta);
      return;
    }
    navigator.clipboard.writeText(text).then(()=> showToast('Copied'), ()=> showToast('Copy failed'));
  }

  function makeCopyable(pre){
    if(pre.dataset.copyable === 'true') return;
    pre.dataset.copyable = 'true';
    pre.classList.add('copyable');

    // add copy hint (left) and button (right)
    const hint = document.createElement('span');
    hint.className = 'copy-hint';
    hint.textContent = 'Click to copy';
    pre.appendChild(hint);

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.innerHTML = '<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M9 9H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg><span style=\"font-size:0.85rem\">Copy</span>';
    pre.appendChild(btn);

    // get code text
    const code = pre.querySelector('code');
    const getCodeText = ()=> code ? code.innerText.replace(/\u00A0/g,' ') : pre.innerText;

    // copy on whole pre click (but exclude clicking the button itself causing double trigger)
    pre.addEventListener('click', function(ev){
      if(ev.target === btn || btn.contains(ev.target)) return;
      copyText(getCodeText());
    });

    // copy on button click
    btn.addEventListener('click', function(ev){
      ev.stopPropagation();
      copyText(getCodeText());
    });

    // keyboard access: Enter or Space
    pre.setAttribute('tabindex','0');
    pre.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        copyText(getCodeText());
      }
    });
  }

  function init(){
    // find pre > code blocks that Jekyll outputs from fenced code.
    // detect common bash/sh classes.
    const selectors = [
      'pre > code.language-bash',
      'pre > code.lang-bash',
      'pre > code.language-sh',
      'pre > code.lang-sh',
    ];
    const codes = document.querySelectorAll(selectors.join(','));
    codes.forEach(code => {
      const pre = code.closest('pre');
      if(!pre) return;
      makeCopyable(pre);
    });
  }

  // Run on DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else init();

})();
