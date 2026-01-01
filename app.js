// --- CONFIGURATION ---
const APIS = [
    {
        url: 'https://catfact.ninja/fact',
        parser: (data) => data.fact
    }
];

const DAILY_LIMIT = 10;
const TIMEOUT_MS = 8000; // Increased to 8s for retries
const STORAGE_KEY = 'useless_facts_daily_count';
const DATE_KEY = 'useless_facts_last_visit';

// --- LOCAL DATA FALLBACK (SPANISH - CAT EDITION) ---
// Used if ALL APIs fail
const LOCAL_FACTS = [
    "Los gatos pasan el 70% de su vida durmiendo.",
    "Un gato doméstico promedio puede correr a unos 48 km/h.",
    "Los gatos no pueden saborear cosas dulces.",
    "El cerebro de un gato es 90% similar al de un ser humano.",
    "Los gatos pueden hacer más de 100 sonidos vocales diferentes, los perros solo 10.",
    "Los gatos tienen 32 músculos en cada oreja.",
    "La nariz de cada gato tiene un patrón único, como la huella dactilar humana.",
    "Los gatos usan sus bigotes para saber si pueden pasar por un espacio.",
    "El ronroneo de un gato ocurre a una frecuencia que ayuda a curar huesos y tejidos.",
    "Los gatos pueden saltar hasta 6 veces su longitud.",
    "Los antiguos egipcios afeitaban sus cejas en señal de duelo cuando su gato fallecía.",
    "Un grupo de gatitos se llama 'kindergarten'.",
    "Los gatos sudan a través de las almohadillas de sus patas.",
    "El dueño promedio de un gato tiene más educación que el dueño promedio de un perro.",
    "Los gatos tienen un órgano especial en el paladar (órgano de Jacobson) que les permite 'probar' los olores.",
    "Isaac Newton inventó la puerta gatera para que su gato no interrumpiera sus experimentos.",
    "El gato más rico del mundo heredó 13 millones de dólares.",
    "Los gatos no tienen clavículas, lo que les permite pasar por cualquier abertura del tamaño de su cabeza.",
    "Los gatos caminan moviendo ambas patas derechas primero y luego ambas patas izquierdas.",
    "La mayoría de los gatos blancos con ojos azules son sordos."
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
    elements.factContainer.textContent = "Vuelve mañana por más datos gatunos 🐱";
    if (elements.factTranslation) {
        elements.factTranslation.textContent = "Come back tomorrow for more cat facts 🐱";
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
    // Using loremflickr for better reliability than cataas
    const randomId = Math.floor(Math.random() * 1000);
    return `https://loremflickr.com/1080/1920/cat?lock=${randomId}`;
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
    // Start Image Load (Independent and always happens)
    const imgUrl = getPicsumUrl();
    const imageLoadPromise = new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(imgUrl);
        img.onerror = () => reject(new Error('Image failed'));
        img.src = imgUrl;
    });

    // Handle Background Update
    let imageLoaded = false;
    imageLoadPromise.then(() => {
        elements.bgImage.style.backgroundImage = `url('${imgUrl}')`;
        elements.bgImage.style.opacity = '1';
        imageLoaded = true;
    }).catch(e => {
        console.warn("Background image failed to load completely", e);
        if (!imageLoaded) elements.bgImage.style.opacity = '0.5';
    });

    // 1. Check limit AFTER starting image load (so we get a nice background even if limited)
    if (!checkLimit()) {
        showLimitMessage();
        return;
    }


    setLoading(true);

    // Image load already started above

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
    // PRIMARY (Top/Big) should be SPANISH
    // SECONDARY (Bottom/Small) should be ENGLISH/ORIGINAL

    if (success) {
        // API Success: Primary = Translated (Spanish), Secondary = Original (English)
        elements.factContainer.textContent = finalTranslatedText;
        if (elements.factTranslation) {
            elements.factTranslation.textContent = finalOriginalText;
        }
    } else {
        // Fallback: Primary = Local (Spanish), Secondary = Label
        elements.factContainer.textContent = finalOriginalText; // Local facts are Spanish
        if (elements.factTranslation) {
            elements.factTranslation.textContent = "— dato local —";
        }
    }

    // Step D: We mostly rely on the async image loader set up at the top.
    // But we might want to wait a tiny bit to sync if it's super fast?
    try {
        await timeoutPromise(1000, imageLoadPromise);
    } catch (e) {
        // Ignored, we just proceed to show text if image takes too long
        console.log("Image taking longer than 1s, revealing text first.");
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
