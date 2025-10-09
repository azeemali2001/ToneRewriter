

const TONES = [
    { id: 'happy', title: 'Happy' },
    { id: 'sad', title: 'Sad' },
    { id: 'angry', title: 'Angry' },
    { id: 'sarcastic', title: 'Sarcastic' },
    { id: 'professional', title: 'Professional' },
    { id: 'casual', title: 'Casual' },
    { id: 'friendly', title: 'Friendly' },
    { id: 'polite', title: 'Polite' },
    { id: 'urgent', title: 'Urgent' },
    { id: 'apologetic', title: 'Apologetic' },
    { id: 'encouraging', title: 'Encouraging' },
    { id: 'informative', title: 'Informative' },
    { id: 'persuasive', title: 'Persuasive' },
    { id: 'neutral', title: 'Neutral' },
    { id: 'humorous', title: 'Humorous' },
    { id: 'motivational', title: 'Motivational' },
    { id: 'concise', title: 'Concise' },
    { id: 'diplomatic', title: 'Diplomatic' },
    { id: 'assertive', title: 'Assertive' },
    { id: 'critical', title: 'Critical' }
];


chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'rewrite_parent',
        title: 'Rewrite selection',
        contexts: ['selection']
    });

    for (const tone of TONES) {
        chrome.contextMenus.create({
            id: `rewrite_tone_${tone.id}`,
            parentId: 'rewrite_parent',
            title: tone.title,
            contexts: ['selection']
        });
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!info.menuItemId.startsWith('rewrite_tone_')) return;
    const toneId = info.menuItemId.replace('rewrite_tone_', '');

    try {
        const [{ result: selectedText }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                const s = window.getSelection()?.toString() || '';
                if (s.trim()) return s;
                const active = document.activeElement;
                if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
                    return active.value.substring(active.selectionStart, active.selectionEnd);
                }
                return '';
            }
        });

        if (!selectedText.trim()) {
            console.warn('ToneRewrite: no text selected.');
            return;
        }

        chrome.tabs.sendMessage(tab.id, {
            type: 'rewrite_with_tone',
            tone: toneId,
            text: selectedText
        });
    } catch (err) {
        console.error('ToneRewrite error:', err);
    }
});


const BACKEND_URL = 'https://tonerewriter-backend.onrender.com/rewrite';
const APP_SECRET = 'some-long-random-string';



chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'rewrite_request') {
        const { text, tone } = msg;

        fetch(BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-app-secret': APP_SECRET
            },
            body: JSON.stringify({ text, tone })
        })
            .then(r => r.json())
            .then(data => {
                if (data?.ok) sendResponse({ ok: true, rewritten: data.rewritten });
                else sendResponse({ ok: false, error: data?.error || 'backend_error' });
            })
            .catch(err => {
                console.error('Backend call failed', err);
                sendResponse({ ok: false, error: err.message });
            });

        return true;
    }
});
