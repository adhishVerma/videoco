// Thin wrapper around the browser's Web Speech API (SpeechRecognition).
// Chrome/Edge desktop and Chrome Android support it; Firefox and iOS
// Safari currently don't - isSupported() lets callers hide the feature
// instead of showing a button that silently does nothing.

let recognition = null;

export const isSpeechRecognitionSupported = () => {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
};

// onResult is called with { finalTranscript, interimTranscript } every time
// the recognizer has something new to report.
export const startCaptioning = (onResult) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        onResult({ finalTranscript: finalTranscript.trim(), interimTranscript: interimTranscript.trim() });
    };

    recognition.onerror = (event) => {
        console.log('speech recognition error', event.error);
    };

    // browsers stop recognition after a period of silence - keep it running
    // for as long as the caller wants captions on.
    recognition.onend = () => {
        if (recognition) {
            try {
                recognition.start();
            } catch (err) {
                // already running / not allowed - ignore, next onend retries
            }
        }
    };

    recognition.start();
    return recognition;
};

export const stopCaptioning = () => {
    if (!recognition) return;
    const active = recognition;
    recognition = null;
    active.onend = null;
    active.stop();
};
