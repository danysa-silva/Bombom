// Amplitude ingestion key — public by design; move to an env var when you set up environments.
import * as amplitude from 'https://cdn.jsdelivr.net/npm/@amplitude/unified@1/+esm';

const AMPLITUDE_API_KEY = 'b3c752a8f7af1dc4e35e48c4029c84a3';

amplitude.initAll(AMPLITUDE_API_KEY, { analytics: { autocapture: true }, sessionReplay: { sampleRate: 1 } });

window.amplitude = amplitude;
