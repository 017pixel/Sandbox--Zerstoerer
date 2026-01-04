/**
 * CodeX Audio Engine
 * Lightweight generative audio for Sandbox-Zerstörer
 */

const AudioEngine = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    isInitialized: false,
    noiseBuffer: null,

    lastPlayed: {},

    init() {
        if (this.isInitialized) {
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
            return;
        }
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0; // Starts at 0, ramps up
            this.musicGain.connect(this.masterGain);

            // Pre-generate noise for efficiency
            this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

            this.isInitialized = true;
            this.updateMusic();
            this.startMusic();

            // Explicitly resume on first tap
            if (this.ctx.state === 'suspended') this.ctx.resume();

            // "Unlock" iOS audio by playing a split second of silence
            const buffer = this.ctx.createBuffer(1, 1, 22050);
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(this.ctx.destination);
            source.start(0);

            console.log("🔊 Audio Engine Ready & Unlocked");
        } catch (e) {
            console.error("Audio Init Failed", e);
        }
    },

    updateMusic() {
        if (!this.isInitialized) return;
        const target = musicEnabled ? 0.15 : 0;
        this.musicGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
    },

    // --- GENERATIVE MUSIC ---
    startMusic() {
        const playPad = (freq, vol) => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            g.gain.setValueAtTime(0, this.ctx.currentTime);

            const loop = () => {
                const now = this.ctx.currentTime;
                g.gain.linearRampToValueAtTime(vol, now + 5);
                g.gain.linearRampToValueAtTime(0, now + 15);
                setTimeout(loop, 20000 + Math.random() * 10000);
            };

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start();
            loop();
        };

        // Minecraft-style base chords (C major 7-ish)
        playPad(130.81, 0.2); // C3
        playPad(164.81, 0.15); // E3
        playPad(196.00, 0.15); // G3
        playPad(246.94, 0.1); // B3

        const melody = () => {
            if (!musicEnabled || !this.isInitialized) { setTimeout(melody, 5000); return; }

            const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25]; // Pentatonic
            const freq = notes[Math.floor(Math.random() * notes.length)];

            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            g.gain.setValueAtTime(0, this.ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.08, this.ctx.currentTime + 2);
            g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 8);

            osc.connect(g);
            g.connect(this.musicGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 9);

            setTimeout(melody, 12000 + Math.random() * 15000);
        };
        melody();
    },

    // --- SFX ---
    play(type, volume = 1.0, pitch = 1.0) {
        if (!this.isInitialized || !sfxEnabled) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = Date.now();
        const minGap = { 'place': 30, 'fire': 150, 'water': 120, 'vine': 200, 'explosion': 400, 'firework': 250, 'uranium_pulse': 1000 }[type] || 50;
        if (this.lastPlayed[type] && now - this.lastPlayed[type] < minGap) return;
        this.lastPlayed[type] = now;

        const mainGain = this.ctx.createGain();
        mainGain.gain.value = volume;
        mainGain.connect(this.masterGain);
        const t = this.ctx.currentTime;

        switch (type) {
            case 'place': this.synthPop(t, mainGain, pitch); break;
            case 'fire': this.synthFire(t, mainGain); break;
            case 'water': this.synthWater(t, mainGain); break;
            case 'vine': this.synthVine(t, mainGain); break;
            case 'explosion': this.synthBoom(t, mainGain, 3.0); break;
            case 'tnt': this.synthBoom(t, mainGain, 1.8); break;
            case 'firework': this.synthPop(t, mainGain, 2.0); break;
            case 'uranium_pulse': this.synthPulse(t, mainGain); break;
        }
    },

    synthPop(t, g, p) {
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(400 * p, t);
        osc.frequency.exponentialRampToValueAtTime(1, t + 0.1);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.1);
    },

    synthFire(t, g) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        noise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(400, t + 0.4);
        filter.Q.value = 2;

        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.2, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        noise.connect(filter);
        filter.connect(g);
        noise.start(t);
        noise.stop(t + 0.5);
    },

    synthWater(t, g) {
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(200 + Math.random() * 100, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.4);
    },

    synthVine(t, g) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2500;
        g.gain.setValueAtTime(0.05, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        noise.connect(filter);
        filter.connect(g);
        noise.start(t);
        noise.stop(t + 0.1);
    },

    synthBoom(t, g, intensity) {
        // Kick
        const osc = this.ctx.createOscillator();
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.8);

        // Rumble
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 100;

        g.gain.setValueAtTime(intensity, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

        osc.connect(g);
        noise.connect(lp);
        lp.connect(g);

        osc.start(t);
        noise.start(t);
        osc.stop(t + 0.9);
        noise.stop(t + 0.9);
    },

    synthPulse(t, g) {
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(50, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.2);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(g);
        osc.start(t);
        osc.stop(t + 0.3);
    }
};

// Global tap listeners to unlock and resume audio
const unlock = () => AudioEngine.init();
window.addEventListener('mousedown', unlock);
window.addEventListener('touchstart', unlock);
window.addEventListener('keydown', unlock);
