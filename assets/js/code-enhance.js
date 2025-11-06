

(function(){
  const LANG_LABELS = {
    bash: 'Bash', sh: 'Bash', shell: 'Bash', 'shell-session': 'Shell',
    python: 'Python', py: 'Python',
    javascript: 'JavaScript', js: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
    ruby: 'Ruby', rb: 'Ruby',
    html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', toml: 'TOML', xml: 'XML',
    powershell: 'PowerShell', ps1: 'PowerShell',
    go: 'Go', rust: 'Rust', c: 'C', cpp: 'C++', java: 'Java',
    text: 'Text', plaintext: 'Text'
  };

  function langFromClass(codeEl){
    const cls = (codeEl.className || '').toLowerCase();
    const m = cls.match(/language-([a-z0-9+\-]+)/) || cls.match(/lang-([a-z0-9+\-]+)/);
    return m ? m[1] : 'text';
  }

  function prettyLang(key){
    return LANG_LABELS[key] || (key ? key.replace(/^\w/, c => c.toUpperCase()) : 'Text');
  }

  function detectFilename(codeEl){
    // First non-empty line comment "filename:" / "file:" / "fname:"
    const raw = codeEl.textContent || '';
    const firstLine = raw.split('\n').find(l => l.trim().length > 0) || '';
    const m = firstLine.match(/^\s*(#|\/\/|;|--)?\s*(file(?:name)?|fname)\s*:\s*(.+)$/i);
    return m ? m[3].trim() : '';
  }

  function createToast(){
    let t = document.getElementById('copy-toast');
    if(t) return t;
    t = document.createElement('div');
    t.id = 'copy-toast';
    t.innerHTML = '<span class="icon" aria-hidden="true"></span><span class="msg">Copied</span>';
    document.body.appendChild(t);
    return t;
  }

  function showToast(text){
    const toast = createToast();
    toast.querySelector('.msg').textContent = text || 'Copied';
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(()=> toast.classList.remove('show'), 2200);
  }

  function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=> showToast('Copied'), ()=> showToast('Copy failed'));
      return;
    }
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('Copied'); } catch(e){ showToast('Copy failed'); }
    document.body.removeChild(ta);
  }

  function enhance(pre, code){
    // Skip if already enhanced
    if(pre.closest('.code-block')) return;

    const wrapper = document.createElement('figure');
    wrapper.className = 'code-block';

    const toolbar = document.createElement('div');
    toolbar.className = 'code-toolbar';

    const id = document.createElement('span');
    id.className = 'code-id';

    const dot = document.createElement('span');
    dot.className = 'code-dot';
    id.appendChild(dot);

    const langKey = langFromClass(code);
    const lang = prettyLang(langKey);
    wrapper.dataset.lang = lang;

    const langEl = document.createElement('span');
    langEl.className = 'code-lang';
    langEl.textContent = lang;
    id.appendChild(langEl);

    const filename = code.getAttribute('data-filename') || detectFilename(code);
    if(filename){
      const fileEl = document.createElement('span');
      fileEl.className = 'code-filename';
      fileEl.textContent = filename;
      id.appendChild(fileEl);
    }

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'code-btn copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.textContent = 'Copy';

    actions.appendChild(copyBtn);

    toolbar.appendChild(id);
    toolbar.appendChild(actions);

    // Insert structure
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(pre);

    // Prepare copy
    pre.classList.add('copyable');
    const getCodeText = ()=> (code.innerText || code.textContent || '').replace(/\u00A0/g,' ');

    // Click anywhere (except toolbar buttons) copies
    pre.addEventListener('click', (ev)=>{
      copyText(getCodeText());
    });

    copyBtn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      copyText(getCodeText());
    });

    // Keyboard accessibility
    pre.setAttribute('tabindex','0');
    pre.addEventListener('keydown', e=>{
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        copyText(getCodeText());
      }
    });
  }

  function init(){
    const blocks = document.querySelectorAll('pre > code');
    blocks.forEach(code => {
      const pre = code.closest('pre');
      if(!pre) return;
      enhance(pre, code);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
