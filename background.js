

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

const GEMINI_API_KEY = "AIzaSyDkmsNroMaqXom1mkjVfMzNUnmH5M5rIT4";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'rewrite_request') {
        const { text, tone } = msg;

        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: `Rewrite the following sentence in a ${tone} tone. 
Keep it concise, replace the original text directly, and correct any grammar or punctuation errors — no explanations, examples, or extra sentences. 
Return only the fully polished, rewritten sentence:\n\n"${text}"`
                            }
                        ]
                    }
                ]
            })
        })
            .then(res => res.json())
            .then(data => {
                const rewritten =
                    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
                    "Error: No response from Gemini";
                sendResponse({ ok: true, rewritten });
            })
            .catch(err => {
                console.error("Gemini API error:", err);
                sendResponse({ ok: false, error: err.message });
            });

        return true;
    }
});
