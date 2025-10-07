
if (!window.__toneRewriteInjected) {
    window.__toneRewriteInjected = true;

    let savedSelection = null;

    chrome.runtime.onMessage.addListener((msg, sender) => {
        if (msg?.type === 'rewrite_with_tone') {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                savedSelection = sel.getRangeAt(0).cloneRange();
            }
            const { tone, text } = msg;
            showFloatingPanelWithOriginalAndTone(text, tone);
        }
    });

    function showFloatingPanelWithOriginalAndTone(originalText, tone) {
        // Remove existing panel if any
        const existing = document.getElementById('tone-rewrite-panel');
        if (existing) existing.remove();

        const panel = document.createElement('div');
        panel.id = 'tone-rewrite-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            zIndex: 2147483647,
            right: '20px',
            bottom: '20px',
            width: '360px',
            background: '#fff',
            border: '1px solid #ddd',
            boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            padding: '12px',
            borderRadius: '10px',
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px',
            color: '#111'
        });

        panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-weight:600">Rewrite (${escapeHtml(tone)})</div>
        <button id="tr-close" title="Close" style="background:none;border:none;cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="margin-bottom:8px;max-height:90px;overflow:auto;border:1px solid #f0f0f0;padding:8px;border-radius:6px;background:#fafafa">
        <div style="font-size:12px;color:#444">Original</div>
        <div id="tr-original" style="white-space:pre-wrap;margin-top:6px">${escapeHtml(originalText)}</div>
      </div>
      <div id="tr-status" style="margin-bottom:8px;color:#666;font-size:12px">Rewriting...</div>
      <div id="tr-result" style="min-height:60px;white-space:pre-wrap;border:1px dashed #eee;padding:8px;border-radius:6px;background:#fff"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
        <button id="tr-replace" disabled>Replace</button>
        <button id="tr-copy" disabled>Copy</button>
      </div>
    `;

        document.body.appendChild(panel);

        // Close handler
        panel.querySelector('#tr-close').addEventListener('click', () => panel.remove());

        // Request rewrite from background
        chrome.runtime.sendMessage({ type: 'rewrite_request', text: originalText, tone }, (res) => {
            const status = panel.querySelector('#tr-status');
            const resultEl = panel.querySelector('#tr-result');
            const btnCopy = panel.querySelector('#tr-copy');
            const btnReplace = panel.querySelector('#tr-replace');

            if (!res) {
                status.textContent = 'No response from background.';
                resultEl.textContent = '';
                return;
            }
            if (!res.ok) {
                status.textContent = 'Error: ' + (res.error || 'unknown');
                resultEl.textContent = '';
                return;
            }

            status.textContent = 'Done';
            resultEl.textContent = res.rewritten;
            btnCopy.disabled = false;
            btnReplace.disabled = false;

            // Copy action
            btnCopy.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(res.rewritten);
                    btnCopy.textContent = 'Copied';
                    setTimeout(() => btnCopy.textContent = 'Copy', 1200);
                } catch (e) {
                    console.error('copy failed', e);
                }
            });

            // Replace action
            btnReplace.addEventListener('click', () => {
                replaceSelectionWithText(res.rewritten);
                panel.remove();
            });
        });
    }

    function replaceSelectionWithText(text) {
        try {
            if (savedSelection) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(savedSelection);

                savedSelection.deleteContents();
                savedSelection.insertNode(document.createTextNode(text));
                sel.removeAllRanges();
                savedSelection = null;
                return;
            }

            // Input/textarea fallback
            const active = document.activeElement;
            if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
                const start = active.selectionStart;
                const end = active.selectionEnd;
                const value = active.value;
                active.value = value.slice(0, start) + text + value.slice(end);
                active.selectionStart = active.selectionEnd = start + text.length;
                active.focus();
                return;
            }

            // fallback: append at end
            document.body.appendChild(document.createTextNode(text));
        } catch (err) {
            console.error('replaceSelectionWithText error', err);
        }
    }

    function escapeHtml(str) {
        return (str + '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
    }
}
