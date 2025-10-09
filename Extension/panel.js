// popup.js
(function () {
  // Ensure only one panel
  function removePanel() {
    const existing = document.getElementById('tr-panel');
    if (existing) existing.remove();
  }

  function escapeHtml(str) {
    return (str + '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function createPanel(originalText, tone) {
    removePanel();

    const panel = document.createElement('div');
    panel.id = 'tr-panel';
    panel.className = 'tr-panel';

    panel.innerHTML = `
      <div class="tr-header">
        <div class="tr-title">Rewrite (${escapeHtml(tone)})</div>
        <button class="tr-close" title="Close">✕</button>
      </div>
      <div class="tr-original-wrap">
        <div class="tr-small">Original</div>
        <div id="tr-original" class="tr-original">${escapeHtml(originalText)}</div>
      </div>
      <div id="tr-status" class="tr-status">Rewriting...</div>
      <div id="tr-result" class="tr-result" role="region" aria-live="polite"></div>
      <div class="tr-actions">
        <button id="tr-replace" class="tr-btn" disabled>Replace</button>
        <button id="tr-copy" class="tr-btn" disabled>Copy</button>
      </div>
    `;

    document.documentElement.appendChild(panel);

    // handlers
    panel.querySelector('.tr-close').addEventListener('click', removePanel);

    const statusEl = panel.querySelector('#tr-status');
    const resultEl = panel.querySelector('#tr-result');
    const btnCopy = panel.querySelector('#tr-copy');
    const btnReplace = panel.querySelector('#tr-replace');

    // Send rewrite request to background
    chrome.runtime.sendMessage({ type: 'rewrite_request', text: originalText, tone }, (res) => {
      if (!res) {
        statusEl.textContent = 'No response from background.';
        resultEl.textContent = '';
        return;
      }
      if (!res.ok) {
        statusEl.textContent = 'Error: ' + (res.error || 'unknown');
        resultEl.textContent = '';
        return;
      }

      statusEl.textContent = 'Done';
      resultEl.textContent = res.rewritten;
      btnCopy.disabled = false;
      btnReplace.disabled = false;

      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(res.rewritten);
          btnCopy.textContent = 'Copied';
          setTimeout(() => btnCopy.textContent = 'Copy', 1200);
        } catch (e) {
          console.error('copy failed', e);
          btnCopy.textContent = 'Copy';
        }
      });

      btnReplace.addEventListener('click', () => {
        // call content.js replacement function
        if (typeof window.__toneRewriteReplace === 'function') {
          window.__toneRewriteReplace(res.rewritten);
        } else {
          console.warn('replace function not found on window');
        }
        removePanel();
      });
    });
  }

  // Listen for the custom event dispatched by content.js
  window.addEventListener('tone-rewrite-show', (ev) => {
    const { text, tone } = ev.detail || {};
    createPanel(text || '', tone || ''); 
  });

  // helpful: allow opening panel manually from console:
  window.__toneRewriteShowDemo = function (text, tone) {
    createPanel(text || '', tone || '');
  };
})();
