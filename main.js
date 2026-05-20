import timerSound from './src/assets/timerend.m4a';

let state = {
    totalSeconds: 450,
    remainingSeconds: 450,
    isRunning: false,
    isMuted: false,
    timerInterval: null
};

const elements = {
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnReset: document.getElementById('btn-reset'),
    btnSound: document.getElementById('btn-sound-toggle'),
    progressBar: document.getElementById('progress-bar'),
    timerContainer: document.querySelector('.timer-container'),
    audioEnd: document.getElementById('audio-end')
};

// Set dynamic source handled by Vite
elements.audioEnd.src = timerSound;

const RADIUS = 250;
const ANGLE_STEP = 40;
const CIRCUMFERENCE = 2 * Math.PI * 350;

class Wheel {
    constructor(id, count, initialVal) {
        this.cylinder = document.getElementById(id);
        this.count = count;
        this.currentVal = initialVal;
        this.offsetAngle = 0; // The fractional rotation between steps
        this.velocity = 0;
        this.items = [];
        this.init();
    }

    init() {
        this.cylinder.innerHTML = '';
        for (let i = -5; i <= 5; i++) { // Slightly larger window for fast spins
            const item = document.createElement('div');
            item.className = 'wheel-item';
            this.cylinder.appendChild(item);
            this.items.push({ el: item, offset: i });
        }
        this.update();
        this.animate();
    }

    update() {
        this.cylinder.style.transform = `rotateX(${this.offsetAngle}deg)`;

        this.items.forEach(item => {
            // Lower values are above (positive item.offset)
            const val = (this.currentVal - item.offset + this.count * 100) % this.count;
            item.el.textContent = val.toString().padStart(2, '0');
            
            // i=1 is ABOVE (angle = 40deg)
            const angle = item.offset * ANGLE_STEP;
            item.el.style.transform = `rotateX(${angle}deg) translateZ(${RADIUS}px)`;
            
            const visualDist = Math.abs(angle + this.offsetAngle) / ANGLE_STEP;
            item.el.style.opacity = Math.max(0, 1 - (visualDist * 0.4));
            item.el.style.filter = `blur(${visualDist * 2.5}px)`;
        });
    }

    // High-performance animation loop for inertia
    animate() {
        if (Math.abs(this.velocity) > 0.05 || Math.abs(this.offsetAngle) > 0.05) {
            this.offsetAngle += this.velocity;
            this.velocity *= 0.94; // Smooth friction

            if (Math.abs(this.velocity) < 0.2) {
                this.offsetAngle *= 0.88; // Auto-center
            }

            // Only update currentVal if the user is scrolling
            if (Math.abs(this.velocity) > 0.2) {
                // If offsetAngle is growing positive (Lower index moving down)
                if (this.offsetAngle > ANGLE_STEP / 2) {
                    this.currentVal = (this.currentVal + 1) % this.count;
                    this.offsetAngle -= ANGLE_STEP;
                    if (!state.isRunning) updateTotalFromWheels();
                } else if (this.offsetAngle < -ANGLE_STEP / 2) {
                    this.currentVal = (this.currentVal - 1 + this.count) % this.count;
                    this.offsetAngle += ANGLE_STEP;
                    if (!state.isRunning) updateTotalFromWheels();
                }
            }

            this.update();
        }
        requestAnimationFrame(() => this.animate());
    }

    scroll(delta) {
        // Delta > 0 is scroll down -> Positive velocity -> Positive offsetAngle 
        // -> Moves top item down into center
        this.velocity += delta * 0.02; 
    }

    // Used by the countdown timer to "tick" smoothly
    tickTo(newVal) {
        if (newVal === this.currentVal) return;
        
        // Calculate the difference (handling wraparound)
        const diff = (this.currentVal - newVal + this.count + this.count / 2) % this.count - this.count / 2;
        
        // Directly update currentVal but shift offsetAngle to mask the jump
        // If currentVal goes 05 -> 04, diff is 1. We want offset to physically stay at 05.
        this.currentVal = newVal;
        this.offsetAngle += diff * ANGLE_STEP; 
        this.velocity = 0; 
        this.update();
    }
}

let wheelMins, wheelSecs;

function unlockAudio() {
    // Attempt a silent play to unlock audio context
    elements.audioEnd.play().then(() => {
        elements.audioEnd.pause();
        elements.audioEnd.currentTime = 0;
        console.log("Audio Unlocked");
    }).catch(e => console.log("Audio unlock attempted:", e));
    
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
}

document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);

function init() {
    wheelMins = new Wheel('cylinder-mins', 100, 7);
    wheelSecs = new Wheel('cylinder-secs', 60, 30);

    updateDisplay();
    
    elements.btnStart.addEventListener('click', startTimer);
    elements.btnPause.addEventListener('click', pauseTimer);
    elements.btnReset.addEventListener('click', resetTimer);
    
    // Sound Toggle
    elements.btnSound.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        elements.btnSound.classList.toggle('muted', state.isMuted);
    });

    document.getElementById('wheel-mins').addEventListener('wheel', (e) => {
        if (state.isRunning) return;
        e.preventDefault();
        wheelMins.scroll(e.deltaY);
    });

    document.getElementById('wheel-secs').addEventListener('wheel', (e) => {
        if (state.isRunning) return;
        e.preventDefault();
        wheelSecs.scroll(e.deltaY);
    });
    
    elements.progressBar.style.strokeDasharray = CIRCUMFERENCE;
    elements.progressBar.style.strokeDashoffset = 0;
}

function updateTotalFromWheels() {
    state.totalSeconds = wheelMins.currentVal * 60 + wheelSecs.currentVal;
    state.remainingSeconds = state.totalSeconds;
    updateDisplay();
}

function updateDisplay() {
    if (state.remainingSeconds < 60) {
        elements.timerContainer.classList.add('low-time');
    } else {
        elements.timerContainer.classList.remove('low-time');
    }
    
    const progress = state.remainingSeconds / (state.totalSeconds || 1);
    const offset = CIRCUMFERENCE * (1 - progress);
    elements.progressBar.style.strokeDashoffset = offset;
}

function startTimer() {
    if (state.isRunning || state.remainingSeconds <= 0) return;
    
    // Unlock audio for later programmatic play (browser requirement)
    elements.audioEnd.load();
    
    state.isRunning = true;
    elements.btnStart.classList.add('hidden');
    elements.btnPause.classList.remove('hidden');
    elements.timerContainer.classList.add('running');
    
    state.timerInterval = setInterval(() => {
        state.remainingSeconds--;
        updateDisplay();
        
        const m = Math.floor(state.remainingSeconds / 60);
        const s = state.remainingSeconds % 60;
        
        wheelMins.tickTo(m);
        wheelSecs.tickTo(s);
        
        if (state.remainingSeconds <= 0) {
            stopTimer();
            if (!state.isMuted) {
                elements.audioEnd.currentTime = 0;
                elements.audioEnd.play().catch(e => console.error("Audio playback failed:", e));
            }
        }
    }, 1000);
}

function pauseTimer() {
    state.isRunning = false;
    clearInterval(state.timerInterval);
    elements.btnStart.classList.remove('hidden');
    elements.btnPause.classList.add('hidden');
    elements.btnStart.textContent = "RESUME";
    elements.timerContainer.classList.remove('running');
}

function stopTimer() {
    state.isRunning = false;
    clearInterval(state.timerInterval);
    elements.btnStart.classList.remove('hidden');
    elements.btnPause.classList.add('hidden');
    elements.btnStart.textContent = "START";
    elements.timerContainer.classList.remove('running');
}

function resetTimer() {
    stopTimer();
    wheelMins.tickTo(7);
    wheelSecs.tickTo(30);
    state.totalSeconds = 450;
    state.remainingSeconds = 450;
    updateDisplay();
}

init();
