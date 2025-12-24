const FACT_API_URL = 'https://uselessfacts.jsph.pl/random.json?language=en';

// Limit Configuration
const DAILY_LIMIT = 10;
const STORAGE_KEY = 'useless_facts_daily_count';
const DATE_KEY = 'useless_facts_last_visit';

const elements = {
    factContainer: document.getElementById('fact-container'),
    factTranslation: document.getElementById('fact-translation'),
    bgImage: document.getElementById('background-image'),
    newFactBtn: document.getElementById('new-fact-btn'),
    loader: document.getElementById('loader'),
};

async function fetchFact() {
    try {
        const response = await fetch(FACT_API_URL);
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data.text;
    } catch (error) {
        console.error('Error fetching fact:', error);
        return 'Did you know? Sometimes the internet breaks. Try again!';
    }
}

async function translateText(text) {
    try {
        // Unofficial Google Translate API (client=gtx)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Translation failed');
        const data = await response.json();
        // Structure: [[["Translated Text", "Original", ...], ...], ...]
        // Sometimes valid text is split into multiple chunks in the first array
        if (data && data[0]) {
            return data[0].map(item => item[0]).join('');
        }
        return '';
    } catch (error) {
        console.error('Translation error:', error);
        return ''; // Return empty string on failure
    }
}

function getPicsumUrl() {
    // Add random parameter to prevent caching
    const randomId = Math.floor(Math.random() * 10000);
    return `https://picsum.photos/1080/1920?random=${randomId}`;
}

// Preload image to avoid pop-in
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = reject;
        img.src = url;
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
        return true; // Limit not reached (new day)
    }

    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    return count < DAILY_LIMIT; // True if under limit
}

function incrementCount() {
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
    localStorage.setItem(STORAGE_KEY, (count + 1).toString());
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

async function handleLoadNewFact() {
    // 1. Check Limit FIRST
    if (!checkLimit()) {
        showLimitMessage();
        return;
    }

    setLoading(true);

    try {
        // Step 1: Fetch content and image
        // To be efficient, we fetch fact first, then translate, 
        // while image matches loosely or random.

        // Actually, let's fetch fact and image in parallel, then translate facts.
        const [fact, imageUrl] = await Promise.all([
            fetchFact(),
            loadImage(getPicsumUrl())
        ]);

        // Step 2: Translate
        let translation = '';
        if (fact) {
            translation = await translateText(fact);
        }

        // Update Text
        elements.factContainer.textContent = fact;
        if (elements.factTranslation) {
            elements.factTranslation.textContent = translation;
        }

        // Update Background
        elements.bgImage.style.opacity = '0';

        setTimeout(() => {
            elements.bgImage.style.backgroundImage = `url('${imageUrl}')`;
            elements.bgImage.style.opacity = '1';

            // Show text
            elements.factContainer.classList.remove('fade-out');
            elements.factContainer.classList.add('fade-in');
            if (elements.factTranslation) {
                elements.factTranslation.classList.remove('fade-out');
                elements.factTranslation.classList.add('fade-in');
            }

            incrementCount();

            if (!checkLimit()) {
                // Limit reached
            }

        }, 300);

    } catch (error) {
        console.error("Error loading content", error);
        elements.factContainer.textContent = "Oops! Something went wrong.";
        if (elements.factTranslation) elements.factTranslation.textContent = "¡Ups! Algo salió mal.";

        elements.factContainer.classList.remove('fade-out');
        elements.factContainer.classList.add('fade-in');
        if (elements.factTranslation) {
            elements.factTranslation.classList.remove('fade-out');
            elements.factTranslation.classList.add('fade-in');
        }
    } finally {
        setLoading(false);
    }
}

// Initial Load
window.addEventListener('DOMContentLoaded', handleLoadNewFact);

// Event Listener
elements.newFactBtn.addEventListener('click', handleLoadNewFact);
