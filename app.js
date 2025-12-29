// --- CONFIGURATION ---
const APIS = [
    {
        url: 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
        parser: (data) => data.text
    },
    {
        url: 'https://catfact.ninja/fact',
        parser: (data) => data.fact
    },
    {
        url: 'https://dummyjson.com/quotes/random',
        parser: (data) => `"${data.quote}" — ${data.author}`
    }
];

const DAILY_LIMIT = 10;
const TIMEOUT_MS = 8000; // Increased to 8s for retries
const STORAGE_KEY = 'useless_facts_daily_count';
const DATE_KEY = 'useless_facts_last_visit';

// --- LOCAL DATA FALLBACK (SPANISH) ---
// Used if ALL APIs fail
const LOCAL_FACTS = [
    "La miel nunca se estropea. Se ha encontrado miel comestible en tumbas egipcias de miles de años.",
    "Los delfines duermen con un ojo abierto.",
    "Un día en Venus es más largo que un año en Venus.",
    "Las nutrias se toman de la mano cuando duermen para no separarse.",
    "El corazón de un colibrí late hasta 1,200 veces por minuto.",
    "Las vacas tienen mejores amigas y se estresan cuando las separan.",
    "Los pulpos tienen tres corazones.",
    "Es imposible tararear mientras te tapas la nariz.",
    "Los plátanos son curvos porque crecen hacia el sol.",
    "El ojo de un avestruz es más grande que su cerebro.",
    "Júpiter es tan grande que cabrían todos los demás planetas del sistema solar dentro de él.",
    "Los koalas tienen huellas dactilares muy parecidas a las humanas.",
    "El agua caliente se congela más rápido que el agua fría (Efecto Mpemba).",
    "Los flamencos nacen grises, no rosas.",
    "El unicornio es el animal nacional de Escocia.",
    "Hay más combinaciones posibles en un juego de ajedrez que átomos en el universo observable.",
    "Los gatos no tienen papilas gustativas para lo dulce.",
    "La Gran Muralla China no es visible desde el espacio a simple vista.",
    "El órgano más grande del cuerpo humano es la piel.",
    "Los mosquitos tienen 47 dientes.",
    "Una nube de tipo cúmulo pesa alrededor de 500 toneladas.",
    "En Júpiter y Saturno llueven diamantes."
];

const elements = {
    factContainer: document.getElementById('fact-container'),
    factTranslation: document.getElementById('fact-translation'),
    bgImage: document.getElementById('background-image'),
    newFactBtn: document.getElementById('new-fact-btn'),
    loader: document.getElementById('loader'),
};

// --- UTILS ---

function getTodayStr() {
    return new Date().toDateString();
}

function checkLimit() {
    const lastVisit = localStorage.getItem(DATE_KEY);
    const today = getTodayStr();

    // Reset if it's a new day
    if (lastVisit !== today) {
        localStorage.setItem(DATE_KEY, today);
        localStorage.setItem(STORAGE_KEY, '0');
        return true;
    }

    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    return count < DAILY_LIMIT;
}

function incrementCount() {
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    localStorage.setItem(STORAGE_KEY, (count + 1).toString());
}

function timeoutPromise(ms, promise) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('TIMEOUT'));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
}

function setLoading(isLoading) {
    if (isLoading) {
        elements.loader.classList.remove('hidden');
        elements.factContainer.classList.add('fade-out');
        elements.factContainer.classList.remove('fade-in');
        if (elements.factTranslation) {
            elements.factTranslation.classList.add('fade-out');
            elements.factTranslation.classList.remove('fade-in');
        }
        elements.newFactBtn.disabled = true;
    } else {
        elements.loader.classList.add('hidden');
        elements.newFactBtn.disabled = false;
    }
}

function showLimitMessage() {
    elements.factContainer.textContent = "Come back tomorrow for more data";
    if (elements.factTranslation) {
        elements.factTranslation.textContent = "Vuelve mañana por más data";
        elements.factTranslation.classList.remove('fade-out');
        elements.factTranslation.classList.add('fade-in');
    }

    elements.factContainer.classList.remove('fade-out');
    elements.factContainer.classList.add('fade-in');

    elements.newFactBtn.disabled = true;
    elements.newFactBtn.style.opacity = '0.5';
    elements.newFactBtn.style.cursor = 'not-allowed';
}

function getPicsumUrl() {
    const randomId = Math.floor(Math.random() * 10000);
    return `https://picsum.photos/1080/1920?random=${randomId}`;
}

async function translateText(text) {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=es&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        if (data && data[0]) {
            return data[0].map(item => item[0]).join('');
        }
    } catch (e) {
        console.warn('Translation failed:', e);
    }
    return ''; // Return empty string on failure logic
}

async function fetchFactFromAnySource() {
    // Try APIs sequentially
    for (const api of APIS) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000); // 3s per API

            const response = await fetch(api.url, { signal: controller.signal });
            clearTimeout(id);

            if (!response.ok) continue;

            const data = await response.json();
            const text = api.parser(data);
            if (text) return text;
        } catch (e) {
            console.warn(`Failed to fetch from ${api.url}`, e);
        }
    }
    throw new Error('All APIs failed');
}

// --- CORE LOGIC ---

async function handleLoadNewFact() {
    // 1. Check limit
    if (!checkLimit()) {
        showLimitMessage();
        return;
    }

    setLoading(true);

    // Start Image Load (Independent)
    const imgUrl = getPicsumUrl();
    const imageLoadPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(imgUrl);
        img.onerror = () => reject(new Error('Image failed'));
        img.src = imgUrl;
    });

    // Start Fact Load (Independent)
    let finalOriginalText = "";
    let finalTranslatedText = "";
    let success = false;

    try {
        // Step A: Get Fact
        const originalText = await fetchFactFromAnySource();
        finalOriginalText = originalText;

        // Step B: Translate
        const translated = await translateText(originalText);
        finalTranslatedText = translated || "Traducción no disponible";
        
        success = true;

    } catch (error) {
        console.warn("All Fact APIs failed, using fallback.", error);
        // Fallback
        const localFact = LOCAL_FACTS[Math.floor(Math.random() * LOCAL_FACTS.length)];
        finalOriginalText = localFact;
        finalTranslatedText = "— dato local —";
        success = false;
    }

    // Step C: Render Text
    elements.factContainer.textContent = finalOriginalText;
    if (elements.factTranslation) {
        elements.factTranslation.textContent = finalTranslatedText;
    }

    // Step D: Handle Background & Reveal
    // We wait up to 3 seconds for image, otherwise show content anyway.
    try {
        await timeoutPromise(3000, imageLoadPromise);
        elements.bgImage.style.backgroundImage = `url('${imgUrl}')`;
        elements.bgImage.style.opacity = '1';
    } catch (e) {
        console.warn("Background image incorrect or timed out", e);
        // Even if timed out, if we have a URL we might want to set it?
        // But for now, just keep default.
        elements.bgImage.style.opacity = '0.5'; 
    }

    // Reveal Content
    elements.factContainer.classList.remove('fade-out');
    elements.factContainer.classList.add('fade-in');
    if (elements.factTranslation) {
        elements.factTranslation.classList.remove('fade-out');
        elements.factTranslation.classList.add('fade-in');
    }

    setLoading(false);
    incrementCount();
}

// Initial Load
window.addEventListener('DOMContentLoaded', handleLoadNewFact);

// Event Listener
elements.newFactBtn.addEventListener('click', handleLoadNewFact);
