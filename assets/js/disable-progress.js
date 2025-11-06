
(function(){
  'use strict';

  const SELECTORS = [
    'progress',
    '[role="progressbar"]',
    '.progress',
    '.progress-bar',
    '.reading-progress',
    '.reading-position',
    '.reading-bar',
    '.top-progress',
    '.meter',
    '.meter-bar',
    '#reading-progress'
  ];

  const BODY_CLASSES_TO_REMOVE = [
    'has-reading-progress',
    'has-progress',
    'reading-progress-active'
  ];

  const DEBUG = false; // set to true to log removals

  function log(...args){
    if(DEBUG) console.log('[disable-progress]', ...args);
  }

  function removeBySelectors(root = document){
    try{
      SELECTORS.forEach(sel => {
        const nodes = root.querySelectorAll(sel);
        nodes.forEach(n => {
          log('remove', sel, n);
          n.remove();
        });
      });
    }catch(e){
      // ignore selector errors
    }
  }

  function stripBodyOffsets(){
    const b = document.body;
    if(!b) return;
    BODY_CLASSES_TO_REMOVE.forEach(c => b.classList.remove(c));
    // Clear inline offsets some themes set for progress bars
    b.style.paddingTop = '0';
    b.style.marginTop = '0';
    document.documentElement.style.setProperty('--progress-height','0px');
    document.documentElement.style.setProperty('--reading-progress-height','0px');
  }

  function injectEmbedCSS(){
    // Minimal CSS for .embed--no-progress wrapper (if site CSS not present)
    const id = 'disable-progress-embed-style';
    if(document.getElementById(id)) return;
    const css = `
.embed--no-progress{position:relative;overflow:hidden;height:var(--visible-height,620px);border-radius:16px}
.embed--no-progress>iframe{height:var(--iframe-height,900px);width:100%;position:relative;top:var(--offset,-130px);display:block}
@media (max-width:900px){.embed--no-progress{height:calc(var(--visible-height,620px) - 40px)}.embed--no-progress>iframe{top:calc(var(--offset,-130px) - 20px)}}
@media (max-width:640px){.embed--no-progress{height:calc(var(--visible-height,620px) - 80px)}.embed--no-progress>iframe{top:calc(var(--offset,-130px) - 40px)}}
`;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function wrapIframesForCropping(root = document){
    // Auto-wrap if iframe has data-no-progress or data-hide-top attribute
    const iframes = root.querySelectorAll('iframe[data-no-progress], iframe[data-hide-top], iframe[data-visible-height], iframe[data-iframe-height]');
    iframes.forEach(iframe => {
      if(iframe.closest('.embed--no-progress')) return; // already wrapped
      const wrapper = document.createElement('div');
      wrapper.className = 'embed--no-progress';

      const visible = iframe.getAttribute('data-visible-height') || iframe.getAttribute('data-visible') || '620px';
      const iframeH = iframe.getAttribute('data-iframe-height') || '900px';
      const offset = iframe.getAttribute('data-hide-top') || iframe.getAttribute('data-offset') || '-130px';

      wrapper.style.setProperty('--visible-height', visible);
      wrapper.style.setProperty('--iframe-height', iframeH);
      wrapper.style.setProperty('--offset', offset);

      log('wrap iframe for cropping', { visible, iframeH, offset, src: iframe.src });

      // Insert wrapper around iframe
      const parent = iframe.parentNode;
      if(!parent) return;
      parent.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);
    });
  }

  function removeProgressEverywhere(root = document){
    removeBySelectors(root);
    stripBodyOffsets();
  }

  function setupObserver(){
    const obs = new MutationObserver(muts => {
      for(const m of muts){
        // Remove progress bars in added nodes
        m.addedNodes.forEach(node => {
          if(node.nodeType !== 1) return;
          // If the node itself is a progress bar element
          if(matchesAnySelector(node, SELECTORS)){
            log('observer remove (self)', node);
            node.remove();
            return;
          }
          // Or contains any
          removeBySelectors(node);
          // Also auto-wrap iframes inside
          wrapIframesForCropping(node);
        });
        // If attributes changed to add role=progressbar on an element
        if(m.type === 'attributes' && m.target && m.attributeName){
          const el = m.target;
          if(matchesAnySelector(el, SELECTORS)){
            log('observer remove (attr)', el);
            el.remove();
          }
        }
      }
    });
    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'class', 'style']
    });
  }

  function matchesAnySelector(el, selectors){
    try{
      return selectors.some(sel => {
        try { return el.matches(sel); } catch { return false; }
      });
    }catch{ return false; }
  }

  function init(){
    removeProgressEverywhere(document);
    injectEmbedCSS();
    wrapIframesForCropping(document);
    setupObserver();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
