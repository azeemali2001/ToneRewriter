// content.js
if (!window.__toneRewriteInjected) {
  window.__toneRewriteInjected = true;

  let savedRange = null;
  let inputState = null; // { el, start, end }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'rewrite_with_tone') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        savedRange = sel.getRangeAt(0).cloneRange();
      } else {
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
          inputState = {
            el: active,
            start: active.selectionStart || 0,
            end: active.selectionEnd || 0
          };
        } else {
          savedRange = null;
          inputState = null;
        }
      }

      // notify UI to show panel (popup.js listens to this event)
      window.dispatchEvent(new CustomEvent('tone-rewrite-show', {
        detail: { text: msg.text, tone: msg.tone }
      }));
    }
  });

  // Called by popup.js to actually replace the saved selection / input
  window.__toneRewriteReplace = function (text) {
    try {
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);

        savedRange.deleteContents();
        savedRange.insertNode(document.createTextNode(text));

        // cleanup
        sel.removeAllRanges();
        savedRange = null;
        return;
      }

      if (inputState && inputState.el) {
        const el = inputState.el;
        const start = inputState.start;
        const end = inputState.end;
        const value = el.value || '';
        el.value = value.slice(0, start) + text + value.slice(end);
        el.selectionStart = el.selectionEnd = start + text.length;
        el.focus();
        inputState = null;
        return;
      }

      // fallback: append at end of body
      document.body.appendChild(document.createTextNode(text));
    } catch (err) {
      console.error('tone-rewrite replace error', err);
    }
  };
}
