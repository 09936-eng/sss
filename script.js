// === GAME STATE & VARIABLES ===
const gameState = {
    screen: 'main-menu',
    score: 0,
    day: 1,
    energy: 100,
    balance: 45,
    soundEnabled: true,
    unlockedLab: { plant: false, herbivore: false, predator: false, water: false },
    achievements: { firstScan: false, labComplete: false, ecoHero: false },
    ecoData: {
        plants: 30,      // %
        rabbits: 85,     // %
        foxes: 15,       // %
        waterQuality: 40 // %
    }
};

// Player & Canvas Settings
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let animationFrameId;

const player = {
    x: 400,
    y: 300,
    size: 24,
    speed: 4,
    dx: 0,
    dy: 0,
    emoji: '🧑‍🔬'
};

// Ecosystem Interactive Entities (Map World)
const entities = [
    { id: 'plant1', x: 150, y: 120, type: 'plant', emoji: '🌱', name: 'พืชผู้ผลิต (Plant)', popKey: 'plants' },
    { id: 'plant2', x: 220, y: 450, type: 'plant', emoji: '🌳', name: 'ต้นไม้ใหญ่ (Forest)', popKey: 'plants' },
    { id: 'rabbit1', x: 550, y: 150, type: 'herbivore', emoji: '🐇', name: 'กระต่าย (Herbivore)', popKey: 'rabbits' },
    { id: 'fox1', x: 680, y: 420, type: 'predator', emoji: '🦊', name: 'สุนัขจิ้งจอก (Predator)', popKey: 'foxes' },
    { id: 'river1', x: 400, y: 500, type: 'water', emoji: '💧', name: 'แม่น้ำ (River Ecosystem)', popKey: 'waterQuality' },
    { id: 'station', x: 100, y: 300, type: 'station', emoji: '🔬', name: 'ศูนย์วิเคราะห์ (Science Station)', popKey: null }
];

let nearestEntity = null;

// === AUDIO SYSTEM (Web Audio API) ===
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (!gameState.soundEnabled) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(400, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        } else if (type === 'scan') {
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'success') {
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        }
    } catch (e) { console.log('Audio Context Error', e); }
}

// === INITIALIZATION & SCREEN NAVIGATION ===
window.addEventListener('load', () => {
    resizeCanvas();
    setupEventListeners();
    updateHUD();
});

window.addEventListener('resize', resizeCanvas);

function resizeCanvas() {
    canvas.width = Math.min(window.innerWidth, 800);
    canvas.height = Math.min(window.innerHeight - 200, 500);
}

function switchScreen(screenId) {
    playSound('click');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    gameState.screen = screenId;

    if (screenId === 'game-screen') {
        gameLoop();
    } else {
        cancelAnimationFrame(animationFrameId);
    }
}

// === EVENT LISTENERS & CONTROLS ===
function setupEventListeners() {
    // Menu Buttons
    document.getElementById('btn-start').addEventListener('click', () => switchScreen('game-screen'));
    document.getElementById('btn-howtoplay').addEventListener('click', () => switchScreen('how-to-play-screen'));
    document.getElementById('btn-lab').addEventListener('click', () => switchScreen('science-lab-screen'));
    document.getElementById('btn-achievements').addEventListener('click', () => switchScreen('achievements-screen'));
    
    document.querySelectorAll('.back-to-menu').forEach(btn => {
        btn.addEventListener('click', () => switchScreen('main-menu'));
    });

    // Sound Toggle
    document.getElementById('btn-sound').addEventListener('click', () => {
        gameState.soundEnabled = !gameState.soundEnabled;
        document.getElementById('btn-sound').innerText = gameState.soundEnabled ? '🔊' : '🔇';
    });

    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
        if (gameState.screen !== 'game-screen') return;
        if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') player.dy = -player.speed;
        if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') player.dy = player.speed;
        if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') player.dx = -player.speed;
        if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') player.dx = player.speed;
        if (e.key === 'e' || e.key === 'E' || e.key === ' ') triggerScanOrAction();
    });

    window.addEventListener('keyup', (e) => {
        if (['w', 'W', 's', 'S', 'ArrowUp', 'ArrowDown'].includes(e.key)) player.dy = 0;
        if (['a', 'A', 'd', 'D', 'ArrowLeft', 'ArrowRight'].includes(e.key)) player.dx = 0;
    });

    // Mobile Virtual Controls
    setupMobileBtn('btn-up', 0, -player.speed);
    setupMobileBtn('btn-down', 0, player.speed);
    setupMobileBtn('btn-left', -player.speed, 0);
    setupMobileBtn('btn-right', player.speed, 0);

    document.getElementById('btn-scan').addEventListener('click', triggerScanOrAction);
    document.getElementById('btn-action').addEventListener('click', () => toggleModal('ecomap-modal', true));
    document.getElementById('btn-ecomap').addEventListener('click', () => toggleModal('ecomap-modal', true));

    // Modal Close Buttons
    document.getElementById('btn-close-scan').addEventListener('click', () => toggleModal('scanner-modal', false));
    document.getElementById('btn-close-ecomap').addEventListener('click', () => toggleModal('ecomap-modal', false));
    document.getElementById('btn-restart').addEventListener('click', resetGame);

    // Eco Map Action Execution
    document.querySelectorAll('.action-exec-btn').forEach(btn => {
        btn.addEventListener('click', (e) => executeEcoAction(e.target.dataset.action));
    });
}

function setupMobileBtn(id, dx, dy) {
    const btn = document.getElementById(id);
    const start = (e) => { e.preventDefault(); player.dx = dx; player.dy = dy; };
    const end = (e) => { e.preventDefault(); player.dx = 0; player.dy = 0; };
    btn.addEventListener('touchstart', start);
    btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
}

// === GAME LOOP & ENGINE ===
function gameLoop() {
    updatePlayer();
    calculateEcosystemBalance();
    drawGameWorld();
    updateHUD();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function updatePlayer() {
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x + player.dx));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y + player.dy));

    // Check interaction range
    nearestEntity = null;
    entities.forEach(ent => {
        const dist = Math.hypot(player.x - ent.x, player.y - ent.y);
        if (dist < 45) {
            nearestEntity = ent;
        }
    });

    const promptEl = document.getElementById('interaction-prompt');
    if (nearestEntity) {
        promptEl.classList.remove('hidden');
        promptEl.innerText = `🔍 กด E หรือ SCAN เพื่อสแกน [${nearestEntity.name}]`;
    } else {
        promptEl.classList.add('hidden');
    }
}

function drawGameWorld() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Environment Zones
    ctx.fillStyle = 'rgba(6, 78, 59, 0.3)';
    ctx.fillRect(50, 50, 250, 200); // Forest Area
    ctx.fillStyle = 'rgba(30, 58, 138, 0.3)';
    ctx.fillRect(300, 420, 450, 60); // River Area

    // Draw Entities
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    entities.forEach(ent => {
        ctx.fillText(ent.emoji, ent.x, ent.y);
        
        // Render indicator if critical
        if (ent.popKey && gameState.ecoData[ent.popKey] < 40) {
            ctx.fillStyle = '#f43f5e';
            ctx.font = '12px Arial';
            ctx.fillText('⚠ Low', ent.x, ent.y - 20);
            ctx.font = '24px Arial';
        }
    });

    // Draw Player
    ctx.fillText(player.emoji, player.x, player.y);
}

// === SCIENCE & SIMULATION LOGIC ===
function calculateEcosystemBalance() {
    const d = gameState.ecoData;
    
    // Ideal balance values: Plants: 60-80%, Rabbits: 40-60%, Foxes: 30-50%, Water: >70%
    let plantScore = Math.max(0, 100 - Math.abs(d.plants - 70) * 1.5);
    let rabbitScore = Math.max(0, 100 - Math.abs(d.rabbits - 50) * 1.5);
    let foxScore = Math.max(0, 100 - Math.abs(d.foxes - 40) * 2);
    let waterScore = d.waterQuality;

    gameState.balance = Math.round((plantScore + rabbitScore + foxScore + waterScore) / 4);

    // Check Win Condition
    if (gameState.balance >= 90) {
        triggerEndGame(true);
    }
}

function simulateEcoCycle() {
    const d = gameState.ecoData;

    // Ecosystem Population Dynamics
    // 1. Plants depend on water quality
    if (d.waterQuality > 50) d.plants = Math.min(100, d.plants + 5);
    else d.plants = Math.max(10, d.plants - 5);

    // 2. Rabbits eat plants (Overpopulation reduces plants, low plants reduces rabbits)
    if (d.plants > 30) {
        d.rabbits = Math.min(100, d.rabbits + 8);
        d.plants = Math.max(10, d.plants - 10); // Grazing effect
    } else {
        d.rabbits = Math.max(10, d.rabbits - 12);
    }

    // 3. Foxes hunt rabbits (High foxes reduce rabbits, low rabbits starve foxes)
    if (d.rabbits > 30) {
        d.foxes = Math.min(100, d.foxes + 6);
        d.rabbits = Math.max(10, d.rabbits - 8);
    } else {
        d.foxes = Math.max(5, d.foxes - 10);
    }

    gameState.day++;
    calculateEcosystemBalance();
}

// === ACTIONS & SCANNER ===
function triggerScanOrAction() {
    if (!nearestEntity) return;
    playSound('scan');

    if (nearestEntity.type === 'station') {
        toggleModal('ecomap-modal', true);
        return;
    }

    // Unlock Achievement
    if (!gameState.achievements.firstScan) {
        gameState.achievements.firstScan = true;
        document.getElementById('ach-1').classList.add('unlocked');
        addScore(100);
    }

    // Prepare Scanner Display
    const scanTitle = document.getElementById('scan-title');
    const scanType = document.getElementById('scan-type');
    const scanFunc = document.getElementById('scan-func');
    const scanPop = document.getElementById('scan-pop');
    const scanStatus = document.getElementById('scan-status');

    scanTitle.innerText = `${nearestEntity.emoji} ${nearestEntity.name}`;
    
    if (nearestEntity.type === 'plant') {
        scanType.innerText = 'PRODUCER (ผู้ผลิต)';
        scanFunc.innerText = 'สร้างอาหารด้วยการสังเคราะห์ด้วยแสง เป็นฐานรากของพลังงาน';
        scanPop.innerText = `${gameState.ecoData.plants}%`;
        scanStatus.innerText = gameState.ecoData.plants < 40 ? '⚠ CRITICAL LOW (วิกฤตพืชต่ำเกินไป)' : 'NORMAL';
        unlockLabCard('card-producer', 'plant');
    } else if (nearestEntity.type === 'herbivore') {
        scanType.innerText = 'PRIMARY CONSUMER (ผู้บริโภคอันดับ 1)';
        scanFunc.innerText = 'กินพืชเพื่อรับถ่ายทอดพลังงาน หากประชากรมากไปจะทำลายผู้ผลิต';
        scanPop.innerText = `${gameState.ecoData.rabbits}%`;
        scanStatus.innerText = gameState.ecoData.rabbits > 75 ? '⚠ OVERPOPULATION (ประชากรมากเกินไป)' : 'NORMAL';
        unlockLabCard('card-herbivore', 'herbivore');
    } else if (nearestEntity.type === 'predator') {
        scanType.innerText = 'PREDATOR (ผู้ล่าระดับสูง)';
        scanFunc.innerText = 'ควบคุมประชากรสัตว์กินพืช ไม่ให้ทำลายพืชพรรณในระบบ';
        scanPop.innerText = `${gameState.ecoData.foxes}%`;
        scanStatus.innerText = gameState.ecoData.foxes < 30 ? '⚠ LOW POPULATION (ผู้ล่าเสี่ยงสูญพันธุ์)' : 'BALANCED';
        unlockLabCard('card-predator', 'predator');
    } else if (nearestEntity.type === 'water') {
        scanType.innerText = 'ENVIRONMENT / RESOURCE';
        scanFunc.innerText = 'แหล่งน้ำสำหรับพืชและสัตว์ ค่ามลพิษสูงส่งผลต่อทั้งระบบนิเวศ';
        scanPop.innerText = `คุณภาพน้ำ: ${gameState.ecoData.waterQuality}%`;
        scanStatus.innerText = gameState.ecoData.waterQuality < 50 ? '⚠ POLLUTED (น้ำเสียมลพิษสูง)' : 'CLEAN';
        unlockLabCard('card-water', 'water');
    }

    consumeEnergy(2);
    addScore(50);
    toggleModal('scanner-modal', true);
}

function executeEcoAction(actionType) {
    playSound('click');
    const d = gameState.ecoData;

    if (actionType === 'plant') {
        if (!useEnergy(20)) return;
        d.plants = Math.min(100, d.plants + 25);
        addScore(150);
    } else if (actionType === 'water') {
        if (!useEnergy(15)) return;
        d.waterQuality = Math.min(100, d.waterQuality + 30);
        addScore(150);
    } else if (actionType === 'fox') {
        if (!useEnergy(25)) return;
        d.foxes = Math.min(100, d.foxes + 20);
        addScore(200);
    } else if (actionType === 'rest') {
        gameState.energy = Math.min(100, gameState.energy + 50);
        simulateEcoCycle();
    }

    calculateEcosystemBalance();
    updateHUD();
    toggleModal('ecomap-modal', false);
}

// === SYSTEM HELPER FUNCTIONS ===
function unlockLabCard(cardId, typeKey) {
    gameState.unlockedLab[typeKey] = true;
    const card = document.getElementById(cardId);
    card.classList.add('unlocked');
    card.querySelector('.status-lock').style.display = 'none';
    card.querySelector('.card-content').classList.remove('hidden');

    // Check all lab unlocked
    if (Object.values(gameState.unlockedLab).every(v => v === true) && !gameState.achievements.labComplete) {
        gameState.achievements.labComplete = true;
        document.getElementById('ach-2').classList.add('unlocked');
        addScore(300);
    }
}

function useEnergy(amount) {
    if (gameState.energy >= amount) {
        gameState.energy -= amount;
        return true;
    } else {
        alert('⚡ พลังงานไม่เพียงพอ! กดพักผ่อน (Rest) เพื่อฟื้นฟูพลังงาน');
        return false;
    }
}

function consumeEnergy(amount) {
    gameState.energy = Math.max(0, gameState.energy - amount);
}

function addScore(pts) {
    gameState.score += pts;
}

function updateHUD() {
    document.getElementById('balance-bar').style.width = `${gameState.balance}%`;
    document.getElementById('balance-val').innerText = `${gameState.balance}%`;
    document.getElementById('energy-bar').style.width = `${gameState.energy}%`;
    document.getElementById('energy-val').innerText = `${gameState.energy}%`;
    document.getElementById('score-val').innerText = gameState.score;
    document.getElementById('day-val').innerText = `DAY ${gameState.day}`;

    // Update Map Node Colors based on status
    const d = gameState.ecoData;
    updateNodeStatus('map-node-plant', d.plants);
    updateNodeStatus('map-node-herb', d.rabbits);
    updateNodeStatus('map-node-pred', d.foxes);
}

function updateNodeStatus(elementId, val) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (val < 35 || val > 85) {
        el.style.borderColor = '#f43f5e';
        el.style.color = '#f43f5e';
    } else {
        el.style.borderColor = '#38bdf8';
        el.style.color = '#e0f2fe';
    }
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
}

function triggerEndGame(isWin) {
    playSound('success');
    cancelAnimationFrame(animationFrameId);
    
    if (gameState.balance >= 90) {
        document.getElementById('ach-3').classList.add('unlocked');
    }

    document.getElementById('end-balance').innerText = `${gameState.balance}%`;
    document.getElementById('end-score').innerText = gameState.score;
    
    let rank = '🥉 JUNIOR ECOLOGIST';
    if (gameState.score > 1500 && gameState.balance >= 90) rank = '🥇 MASTER OF ECOSYSTEM';
    else if (gameState.score > 800) rank = '🥈 ECO SCIENTIST';

    document.getElementById('end-rank').innerText = rank;
    toggleModal('endgame-modal', true);
}

function resetGame() {
    gameState.score = 0;
    gameState.day = 1;
    gameState.energy = 100;
    gameState.balance = 45;
    gameState.ecoData = { plants: 30, rabbits: 85, foxes: 15, waterQuality: 40 };
    player.x = 400;
    player.y = 300;
    
    toggleModal('endgame-modal', false);
    switchScreen('main-menu');
}
