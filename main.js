let state = {
    totalSeconds: 450,
    remainingSeconds: 450,
    isRunning: false,
    timerInterval: null
};

const elements = {
    btnStart: document.getElementById('btn-start'),
    btnPause: document.getElementById('btn-pause'),
    btnReset: document.getElementById('btn-reset'),
    progressBar: document.getElementById('progress-bar'),
    timerContainer: document.querySelector('.timer-container')
};

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

    animate() {
        if (Math.abs(this.velocity) > 0.05 || Math.abs(this.offsetAngle) > 0.05) {
            this.offsetAngle += this.velocity;
            this.velocity *= 0.94; // Smooth friction

            if (Math.abs(this.velocity) < 0.2) {
                this.offsetAngle *= 0.88; // Auto-center
            }

            // CRITICAL: Only update currentVal if the user is scrolling (velocity exists)
            // If we are just auto-centering (velocity small), we DON'T update currentVal
            // This prevents double-counting during programmatic ticks.
            if (Math.abs(this.velocity) > 0.2) {
                if (this.offsetAngle < -ANGLE_STEP / 2) {
                    this.currentVal = (this.currentVal - 1 + this.count) % this.count;
                    this.offsetAngle += ANGLE_STEP;
                    if (!state.isRunning) updateTotalFromWheels();
                } else if (this.offsetAngle > ANGLE_STEP / 2) {
                    this.currentVal = (this.currentVal + 1) % this.count;
                    this.offsetAngle -= ANGLE_STEP;
                    if (!state.isRunning) updateTotalFromWheels();
                }
            }

            this.update();
        }
        requestAnimationFrame(() => this.animate());
    }

    scroll(delta) {
        // scroll up (negative delta) -> negative velocity -> moves lower numbers down
        this.velocity += delta * 0.02; 
    }

    // Used by the countdown timer to "tick" smoothly
    tickTo(newVal) {
        if (newVal === this.currentVal) return;
        
        // Calculate the difference (handling wraparound)
        const diff = (this.currentVal - newVal + this.count + this.count / 2) % this.count - this.count / 2;
        
        // Directly update currentVal but shift offsetAngle to mask the jump
        this.currentVal = newVal;
        this.offsetAngle -= diff * ANGLE_STEP; // Shift offset out of bound
        this.velocity = 0; // Clear any scroll momentum
        this.update();
    }
}

let wheelMins, wheelSecs;

function init() {
    wheelMins = new Wheel('cylinder-mins', 100, 7);
    wheelSecs = new Wheel('cylinder-secs', 60, 30);

    updateDisplay();
    
    elements.btnStart.addEventListener('click', startTimer);
    elements.btnPause.addEventListener('click', pauseTimer);
    elements.btnReset.addEventListener('click', resetTimer);
    
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
