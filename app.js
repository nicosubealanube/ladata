// --- CONFIGURATION ---
const FACT_API_URL = 'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en';
const DAILY_LIMIT = 10;
const TIMEOUT_MS = 5000; // 5 seconds max before fallback kicks in
const STORAGE_KEY = 'useless_facts_daily_count';
const DATE_KEY = 'useless_facts_last_visit';

// --- LOCAL DATA FALLBACK (SPANISH) ---
// Used if APIs fail, timeout, or block CORS.
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
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        if (data && data[0]) {
            return data[0].map(item => item[0]).join('');
        }
    } catch (e) {
        console.warn('Translation failed, returning empty');
    }
    return '';
}

// --- CORE LOGIC ---

async function handleLoadNewFact() {
    // 1. Check limit
    if (!checkLimit()) {
        showLimitMessage();
        return;
    }

    setLoading(true);

    let factDisplayed = false;

    try {
        // RACE: Try to fetch API + Image + Translate within TIMEOUT_MS
        // If it fails, we catch it and use fallback.

        await timeoutPromise(TIMEOUT_MS, (async () => {
            // A. Fetch Fact (API)
            const factResp = await fetch(FACT_API_URL);
            if (!factResp.ok) throw new Error('Fact API failed');
            const factData = await factResp.json();
            const originalText = factData.text;

            // B. Load Image (Parallel-ish)
            // We start image loading here but don't strictly block showing text on it if it's super slow?
            // Actually, for "smoothness" let's wait, but it's part of the global timeout.
            const imgUrl = getPicsumUrl();
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject; // If image fails, we might want to just proceed? 
                img.src = imgUrl;
            });

            // C. Translate
            const translatedText = await translateText(originalText);

            // D. Render
            elements.factContainer.textContent = originalText;
            if (elements.factTranslation) {
                elements.factTranslation.textContent = translatedText || "(Translation unavailable)";
            }

            // Background
            elements.bgImage.style.opacity = '0';
            setTimeout(() => {
                elements.bgImage.style.backgroundImage = `url('${imgUrl}')`;
                elements.bgImage.style.opacity = '1';

                elements.factContainer.classList.remove('fade-out');
                elements.factContainer.classList.add('fade-in');
                if (elements.factTranslation) {
                    elements.factTranslation.classList.remove('fade-out');
                    elements.factTranslation.classList.add('fade-in');
                }
            }, 100);

            factDisplayed = true;
        })());

    } catch (error) {
        console.warn("External API/Network issue:", error);
        // FALLBACK MODE
        const localFact = LOCAL_FACTS[Math.floor(Math.random() * LOCAL_FACTS.length)];

        // In fallback, we use just Spanish text in the main container
        elements.factContainer.textContent = localFact;
        if (elements.factTranslation) elements.factTranslation.textContent = ""; // No translation needed or duplicate?
        // Actually, let's look nice:
        // Main: "Dato Curioso #..." or just the Spanish fact?
        // Let's put Spanish fact in Main and leave Translation empty to keep it clean.

        elements.factContainer.textContent = localFact;
        if (elements.factTranslation) elements.factTranslation.textContent = "— dato local —";

        // Image: Try to load a new one or keep existing? 
        // If image failed, we might be stuck with black BG.
        // Let's try one more loose image fetch in background, or just leave it.
        // Simple: Just show text.

        elements.bgImage.style.opacity = '0.5'; // Dim existing or black

        elements.factContainer.classList.remove('fade-out');
        elements.factContainer.classList.add('fade-in');
        if (elements.factTranslation) {
            elements.factTranslation.classList.remove('fade-out');
            elements.factTranslation.classList.add('fade-in');
        }
    } finally {
        setLoading(false);
        incrementCount(); // Count it even if fallback used
    }
}

// Initial Load
window.addEventListener('DOMContentLoaded', handleLoadNewFact);

// Event Listener
elements.newFactBtn.addEventListener('click', handleLoadNewFact);
