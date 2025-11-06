// Enhance all fenced code blocks: toolbar, copy, language label, optional filename, expand/collapse
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

  function detectFilenameFromFirstLine(codeEl){
    // Look for "# file: name", "// file: name", "; file: name", "-- file: name"
    const raw = codeEl.textContent || '';
    const first = raw.split('\n').find(l => l.trim().length > 0) || '';
    const m = first.match(/^\s*(#|\/\/|;|--)?\s*(file(?:name)?|fname)\s*:\s*(.+)$/i);
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
    // Build wrapper
    const wrapper = document.createElement('figure');
    wrapper.className = 'code-block is-collapsed';

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

    // Optional filename: from data-filename attr or detected comment
    const filename = code.getAttribute('data-filename') || detectFilenameFromFirstLine(code);
    if(filename){
      const fileEl = document.createElement('span');
      fileEl.className = 'code-filename';
      fileEl.textContent = filename;
      id.appendChild(fileEl);
      wrapper.dataset.filename = filename;
    }

    const actions = document.createElement('div');
    actions.className = 'code-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'code-btn copy-btn';
    copyBtn.setAttribute('aria-label', 'Copy code');
    copyBtn.textContent = 'Copy';

    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'code-btn expand-btn';
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.textContent = 'Expand';

    actions.appendChild(copyBtn);
    actions.appendChild(expandBtn);

    toolbar.appendChild(id);
    toolbar.appendChild(actions);

    // Fade overlay for collapsed state
    const fade = document.createElement('div');
    fade.className = 'code-fade';

    // Insert DOM
    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(pre);
    wrapper.appendChild(fade);

    // Prepare copy
    pre.classList.add('copyable');
    const getCodeText = ()=> (code.innerText || code.textContent || '').replace(/\u00A0/g,' ');

    pre.addEventListener('click', (ev)=>{
      const isBtn = ev.target === copyBtn || ev.target === expandBtn || ev.target.closest('.code-btn');
      if(isBtn) return;
      copyText(getCodeText());
    });
    copyBtn.addEventListener('click', (ev)=> {
      ev.stopPropagation();
      copyText(getCodeText());
    });

    // Expand/collapse based on actual height
    function updateCollapsed(){
      // If short, un-collapse and hide button
      const tooTall = pre.scrollHeight > 420;
      if(!tooTall){
        wrapper.classList.remove('is-collapsed');
        expandBtn.style.display = 'none';
      }else{
        wrapper.classList.add('is-collapsed');
        expandBtn.style.display = '';
        expandBtn.setAttribute('aria-expanded', 'false');
        expandBtn.textContent = 'Expand';
      }
    }
    updateCollapsed();
    window.addEventListener('resize', ()=> { updateCollapsed(); });

    expandBtn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const collapsed = wrapper.classList.toggle('is-collapsed');
      expandBtn.setAttribute('aria-expanded', (!collapsed).toString());
      expandBtn.textContent = collapsed ? 'Expand' : 'Collapse';
    });

    // Keyboard access for copy on Enter/Space
    pre.setAttribute('tabindex','0');
    pre.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        copyText(getCodeText());
      }
    });
  }

  function init(){
    // Avoid double-enhancing
    const blocks = document.querySelectorAll('pre > code');
    blocks.forEach(code => {
      const pre = code.closest('pre');
      if(!pre || pre.closest('.code-block')) return;
      enhance(pre, code);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else init();

})();
