'use strict';

// Elementos do DOM
const fluidCanvas = document.getElementById('fluidCanvas');
const webcamCanvas = document.getElementById('webcamCanvas');
const webcamVideo = document.getElementById('webcamVideo');
const statusElement = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const sensitivitySlider = document.getElementById('sensitivity');
const sensitivityValue = document.getElementById('sensitivityValue');
const fluidDensitySlider = document.getElementById('fluidDensity');
const fluidDensityValue = document.getElementById('fluidDensityValue');
const fluidVelocitySlider = document.getElementById('fluidVelocity');
const fluidVelocityValue = document.getElementById('fluidVelocityValue');
const colorModeSelect = document.getElementById('colorMode');

// Contextos de canvas
const webcamCtx = webcamCanvas.getContext('2d');

// Configuração inicial
let config = {
    TEXTURE_DOWNSAMPLE: 1,
    DENSITY_DISSIPATION: 0.98,
    VELOCITY_DISSIPATION: 0.99,
    PRESSURE_DISSIPATION: 0.8,
    PRESSURE_ITERATIONS: 25,
    CURL: 30,
    SPLAT_RADIUS: 0.005,
    SPLAT_FORCE: 6000,
    SHADING: true,
    COLORFUL: true,
    PAUSED: false,
    BACK_COLOR: { r: 0, g: 0, b: 0 },
    TRANSPARENT: false,
    BLOOM: true,
    BLOOM_ITERATIONS: 8,
    BLOOM_RESOLUTION: 256,
    BLOOM_INTENSITY: 0.8,
    BLOOM_THRESHOLD: 0.6,
    BLOOM_SOFT_KNEE: 0.7
};

// Variáveis para detecção de movimento
let previousPixels = null;
let motionDetected = false;
let motionX = 0;
let motionY = 0;
let motionAmount = 0;
let sensitivity = 30;
let webcamInitialized = false;
let lastSplatTime = Date.now();

// WebGL variáveis globais
let gl, ext;
let pointers = [];
let splatStack = [];
let ditheringTexture;

// FBOs
let density;
let velocity;
let divergence;
let curl;
let pressure;
let bloom;

// Shaders e Programas
let bloomProgram;
let blurProgram;
let copyProgram;
let clearProgram;
let colorProgram;
let curlProgram;
let displayProgram;
let divergenceProgram;
let pressureProgram;
let gradientSubtractProgram;
let advectionProgram;
let splatProgram;

// Inicialização
window.addEventListener('load', function () {
    setupUIEvents();
    initializeFluidSimulation();
});

// Configurar eventos de UI
function setupUIEvents() {
    startBtn.addEventListener('click', function () {
        initializeWebcam();
        this.disabled = true;
    });

    resetBtn.addEventListener('click', function () {
        // Resetar simulação
        splatStack = [];
        multipleSplats(parseInt(Math.random() * 20) + 5);
    });

    sensitivitySlider.addEventListener('input', function () {
        sensitivity = this.value;
        sensitivityValue.textContent = sensitivity;
    });

    fluidDensitySlider.addEventListener('input', function () {
        const density = this.value / 100;
        config.DENSITY_DISSIPATION = 1 - (density * 0.3);
        fluidDensityValue.textContent = this.value;
    });

    fluidVelocitySlider.addEventListener('input', function () {
        const velocity = this.value / 100;
        config.VELOCITY_DISSIPATION = 0.9 + (velocity * 0.09);
        fluidVelocityValue.textContent = this.value;
    });
}

// Inicialização da webcam
function initializeWebcam() {
    // Verificar suporte a getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusElement.textContent = "Seu navegador não suporta acesso à webcam";
        return;
    }

    // Solicitar acesso à webcam
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(function (stream) {
            webcamVideo.srcObject = stream;
            webcamInitialized = true;
            statusElement.textContent = "Webcam ativa. Movimente suas mãos para interagir com o fluido.";

            // Iniciar o processamento de detecção de movimento
            processWebcamFrame();
        })
        .catch(function (error) {
            statusElement.textContent = "Erro ao acessar webcam: " + error.message;
        });
}

// Processar o quadro da webcam para detecção de movimento
function processWebcamFrame() {
    if (!webcamInitialized) return;

    // Ajustar o tamanho do canvas da webcam conforme as dimensões do vídeo
    if (webcamVideo.videoWidth > 0) {
        const aspectRatio = webcamVideo.videoWidth / webcamVideo.videoHeight;
        webcamCanvas.width = 160;
        webcamCanvas.height = webcamCanvas.width / aspectRatio;
    }

    // Desenhar o quadro atual da webcam no canvas
    webcamCtx.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);

    // Obter os dados da imagem
    const currentPixels = webcamCtx.getImageData(0, 0, webcamCanvas.width, webcamCanvas.height);

    // Verificar se temos pixels anteriores para comparar
    if (previousPixels) {
        // Detectar movimento comparando os pixels
        const { detected, avgX, avgY, amount } = detectMotion(
            previousPixels.data,
            currentPixels.data,
            webcamCanvas.width,
            webcamCanvas.height
        );

        // Atualizar variáveis de estado
        motionDetected = detected;
        if (detected) {
            motionX = avgX;
            motionY = avgY;
            motionAmount = amount;

            // Adicionar um splat na posição do movimento detectado
            if (Date.now() - lastSplatTime > 50) {
                const x = motionX * (fluidCanvas.width / webcamCanvas.width);
                const y = motionY * (fluidCanvas.height / webcamCanvas.height);
                
                // Adiciona um splat com força baseada na quantidade de movimento
                addSplat(x, y, motionAmount);
                lastSplatTime = Date.now();
            }
        }
    }

    // Armazenar os pixels atuais para a próxima comparação
    previousPixels = currentPixels;

    // Continuar o processamento no próximo quadro
    requestAnimationFrame(processWebcamFrame);
}

// Detectar movimento comparando dois quadros
function detectMotion(previous, current, width, height) {
    // Sensibilidade ajustada pelo slider
    const sens = sensitivity / 100;
    // Número mínimo de pixels diferentes para considerar movimento
    const threshold = 15 * sens;

    let diffCount = 0;
    let sumX = 0;
    let sumY = 0;
    let totalDiff = 0;

    // Percorrer todos os pixels comparando valores RGB
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            // Diferença entre as componentes RGB
            const diffR = Math.abs(previous[i] - current[i]);
            const diffG = Math.abs(previous[i + 1] - current[i + 1]);
            const diffB = Math.abs(previous[i + 2] - current[i + 2]);

            // Diferença média para o pixel
            const diff = (diffR + diffG + diffB) / 3;

            // Se a diferença for maior que o limiar, considerar um movimento
            if (diff > threshold) {
                diffCount++;
                sumX += x;
                sumY += y;
                totalDiff += diff;

                // Destacar os pixels com movimento (opcional)
                current[i] = 255;    // R
                current[i + 1] = 0;  // G
                current[i + 2] = 0;  // B
            }
        }
    }

    // Calcular a posição média do movimento
    let avgX = diffCount > 0 ? sumX / diffCount : 0;
    let avgY = diffCount > 0 ? sumY / diffCount : 0;

    // Calcular a quantidade de movimento como porcentagem dos pixels totais
    const pixelPercentage = (diffCount / (width * height)) * 100;

    // Atualizar o canvas da webcam com os pixels destacados
    webcamCtx.putImageData(new ImageData(current, width, height), 0, 0);

    // Desenhar um círculo na posição do movimento detectado
    if (diffCount > 0) {
        webcamCtx.beginPath();
        webcamCtx.arc(avgX, avgY, 5, 0, 2 * Math.PI);
        webcamCtx.strokeStyle = 'lime';
        webcamCtx.lineWidth = 2;
        webcamCtx.stroke();
    }

    // Retornar resultado da detecção
    return {
        detected: pixelPercentage > 1,  // Mais de 1% dos pixels mudaram
        avgX: avgX,
        avgY: avgY,
        amount: pixelPercentage
    };
}

// A partir daqui, implementação da simulação de fluido com WebGL
// Adaptado do projeto WebGL Fluid Simulation de Pavel Dobryakov

function initializeFluidSimulation() {
    // Inicialização do contexto WebGL
    gl = fluidCanvas.getContext('webgl2');
    const isWebGL2 = !!gl;
    if (!isWebGL2) {
        gl = fluidCanvas.getContext('webgl') || fluidCanvas.getContext('experimental-webgl');
    }

    if (!gl) {
        statusElement.textContent = "WebGL não suportado pelo seu navegador";
        return;
    }

    // Extensões necessárias para rendering
    if (isWebGL2) {
        gl.getExtension('EXT_color_buffer_float');
        ext = {
            formatRGBA: gl.RGBA16F,
            formatRG: gl.RG16F,
            formatR: gl.R16F,
            halfFloatTexType: gl.HALF_FLOAT,
            supportLinearFiltering: gl.getExtension('OES_texture_float_linear')
        };
    } else {
        ext = {
            formatRGBA: gl.RGBA,
            formatRG: gl.RGBA,
            formatR: gl.RGBA,
            halfFloatTexType: gl.getExtension('OES_texture_half_float').HALF_FLOAT_OES,
            supportLinearFiltering: gl.getExtension('OES_texture_half_float_linear')
        };
    }

    // Inicialização dos shaders e programas
    initShaders();
    
    // Inicialização dos framebuffers
    initFramebuffers();

    // Ajustar o tamanho do canvas para o tamanho da janela
    resizeCanvas();
    
    // Adicionar ouvintes de eventos para mouse/touch
    initPointerEvents();

    // Iniciar o loop de animação
    animateFluid();
}

// Inicialização dos shaders para a simulação de fluidos
function initShaders() {
    // Esta função iria criar os programas GLSL
    // Na implementação real, aqui você teria shaders para advecção, divergência, pressão, etc.
    // Por simplicidade, não estamos incluindo todos os shaders aqui
    console.log("Shaders inicializados");
}

// Inicialização dos framebuffers para a simulação
function initFramebuffers() {
    // Esta função iria criar os FBOs (Frame Buffer Objects)
    // Aqui seriam configurados os framebuffers para densidade, velocidade, etc.
    console.log("Framebuffers inicializados");
}

// Adicionar interação do mouse/touch
function initPointerEvents() {
    // Registrar eventos de mouse/touch
    fluidCanvas.addEventListener('mousemove', pointerMove);
    fluidCanvas.addEventListener('touchmove', touchMove);
    
    // Eventos de clique/toque
    fluidCanvas.addEventListener('mousedown', pointerDown);
    fluidCanvas.addEventListener('touchstart', touchStart);
    
    // Eventos de soltar
    window.addEventListener('mouseup', pointerUp);
    window.addEventListener('touchend', touchEnd);
}

// Função para redimensionar o canvas
function resizeCanvas() {
    // Configurar o tamanho do canvas para corresponder ao tamanho da janela
    fluidCanvas.width = window.innerWidth;
    fluidCanvas.height = window.innerHeight;
    
    // Em uma implementação real, você também precisaria reajustar os framebuffers
    console.log("Canvas redimensionado para: " + fluidCanvas.width + "x" + fluidCanvas.height);
}

// Loop de animação principal
function animateFluid() {
    // Aqui seria o código real para renderizar cada quadro da simulação de fluido
    
    // Verificar se o movimento foi detectado e adicionar um splat
    if (motionDetected && webcamInitialized && Date.now() - lastSplatTime > 50) {
        const x = motionX * (fluidCanvas.width / webcamCanvas.width);
        const y = motionY * (fluidCanvas.height / webcamCanvas.height);
        
        addSplat(x, y, motionAmount);
        lastSplatTime = Date.now();
    }
    
    // Solicitar o próximo quadro
    requestAnimationFrame(animateFluid);
}

// Adicionar um splat (respingo) na simulação
function addSplat(x, y, amount) {
    // Normalização das coordenadas
    const posX = x / fluidCanvas.width;
    const posY = 1.0 - y / fluidCanvas.height;
    
    // Criação de um vetor de força baseado na quantidade de movimento
    const splatForce = config.SPLAT_FORCE * (amount / 100);
    
    // Velocidade aleatória para o splat
    const dx = (Math.random() - 0.5) * splatForce;
    const dy = (Math.random() - 0.5) * splatForce;
    
    // Escolha de cor de acordo com o modo selecionado
    let color;
    const colorMode = colorModeSelect.value;
    
    switch(colorMode) {
        case 'blue':
            color = { r: 0.2, g: 0.3, b: 0.9 };
            break;
        case 'red':
            color = { r: 0.9, g: 0.2, b: 0.2 };
            break;
        case 'random':
            color = {
                r: Math.random(),
                g: Math.random(),
                b: Math.random()
            };
            break;
        case 'rainbow':
        default:
            // Cor baseada na posição e no tempo
            const t = performance.now() / 1000;
            color = {
                r: 0.5 + 0.5 * Math.sin(t + 0),
                g: 0.5 + 0.5 * Math.sin(t + 2),
                b: 0.5 + 0.5 * Math.sin(t + 4)
            };
    }
    
    // Na implementação real, aqui seria chamada a função splat()
    console.log(`Splat at (${x}, ${y}) with force (${dx}, ${dy}) and color:`, color);
}

// Função para criar múltiplos splats
function multipleSplats(amount) {
    for (let i = 0; i < amount; i++) {
        const x = Math.random() * fluidCanvas.width;
        const y = Math.random() * fluidCanvas.height;
        const dx = (Math.random() - 0.5) * 2000;
        const dy = (Math.random() - 0.5) * 2000;
        addSplat(x, y, 100);
    }
}

// Handlers de eventos de mouse/touch
function pointerDown(e) {
    // Lidar com clique do mouse
    const posX = scaleByPixelRatio(e.offsetX);
    const posY = scaleByPixelRatio(e.offsetY);
    let pointer = pointers.find(p => p.id === -1);
    if (pointer == null) pointer = new Pointer();
    updatePointerDownData(pointer, -1, posX, posY);
}

function touchStart(e) {
    // Lidar com toque na tela
    e.preventDefault();
    const touches = e.targetTouches;
    for (let i = 0; i < touches.length; i++) {
        if (i >= pointers.length) pointers.push(new Pointer());
        
        const posX = scaleByPixelRatio(touches[i].pageX);
        const posY = scaleByPixelRatio(touches[i].pageY);
        updatePointerDownData(pointers[i], touches[i].identifier, posX, posY);
    }
}

function pointerMove(e) {
    // Lidar com movimento do mouse
    const pointer = pointers[0];
    if (!pointer.down) return;
    
    const posX = scaleByPixelRatio(e.offsetX);
    const posY = scaleByPixelRatio(e.offsetY);
    updatePointerMoveData(pointer, posX, posY);
}

function touchMove(e) {
    // Lidar com movimento de toque
    e.preventDefault();
    const touches = e.targetTouches;
    for (let i = 0; i < touches.length; i++) {
        const pointer = pointers[i];
        if (!pointer.down) continue;
        
        const posX = scaleByPixelRatio(touches[i].pageX);
        const posY = scaleByPixelRatio(touches[i].pageY);
        updatePointerMoveData(pointer, posX, posY);
    }
}

function pointerUp(e) {
    // Lidar com soltar o mouse
    const pointer = pointers.find(p => p.id === -1);
    if (pointer == null) return;
    updatePointerUpData(pointer);
}

function touchEnd(e) {
    // Lidar com fim do toque
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
        const pointer = pointers.find(p => p.id === touches[i].identifier);
        if (pointer == null) continue;
        updatePointerUpData(pointer);
    }
}

// Funções auxiliares
function scaleByPixelRatio(input) {
    const pixelRatio = window.devicePixelRatio || 1;
    return Math.floor(input * pixelRatio);
}

// Classe para rastrear ponteiros (mouse/touch)
class Pointer {
    constructor() {
        this.id = -1;
        this.down = false;
        this.x = 0;
        this.y = 0;
        this.prevX = 0;
        this.prevY = 0;
        this.dx = 0;
        this.dy = 0;
    }
}

// Funções para atualizar dados do ponteiro
function updatePointerDownData(pointer, id, x, y) {
    pointer.id = id;
    pointer.down = true;
    pointer.x = x;
    pointer.y = y;
    pointer.prevX = x;
    pointer.prevY = y;
    pointer.dx = 0;
    pointer.dy = 0;
}

function updatePointerMoveData(pointer, x, y) {
    pointer.prevX = pointer.x;
    pointer.prevY = pointer.y;
    pointer.x = x;
    pointer.y = y;
    pointer.dx = pointer.x - pointer.prevX;
    pointer.dy = pointer.y - pointer.prevY;
}

function updatePointerUpData(pointer) {
    pointer.down = false;
}
