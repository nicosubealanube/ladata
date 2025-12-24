const FACT_API_URL = 'https://uselessfacts.jsph.pl/random.json?language=en';

// Limit Configuration
const DAILY_LIMIT = 10;
const STORAGE_KEY = 'useless_facts_daily_count';
const DATE_KEY = 'useless_facts_last_visit';

const elements = {
    factContainer: document.getElementById('fact-container'),
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
        elements.factContainer.classList.add('fade-out'); // Hide text while loading
        elements.factContainer.classList.remove('fade-in');
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
    elements.factContainer.textContent = "Vuelve mañana por más data";
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
        // Parallel fetch for speed
        const [fact, imageUrl] = await Promise.all([
            fetchFact(),
            loadImage(getPicsumUrl()) // Fetch image URL and wait for it to load
        ]);

        // Update Text
        elements.factContainer.textContent = fact;

        // Update Background
        elements.bgImage.style.opacity = '0';

        setTimeout(() => {
            elements.bgImage.style.backgroundImage = `url('${imageUrl}')`;
            elements.bgImage.style.opacity = '1';

            // Show text
            elements.factContainer.classList.remove('fade-out');
            elements.factContainer.classList.add('fade-in');

            // Increment Count only after successful load
            incrementCount();

            // Optional: Check if limit reached to disable immediately?
            // If we want to be strict, we can check here.

        }, 300); // Short delay to allow opacity to reset

    } catch (error) {
        console.error("Error loading content", error);
        elements.factContainer.textContent = "Oops! Something went wrong.";
        elements.factContainer.classList.remove('fade-out');
        elements.factContainer.classList.add('fade-in');
    } finally {
        setLoading(false);
    }
}

// Initial Load
window.addEventListener('DOMContentLoaded', handleLoadNewFact);

// Event Listener
elements.newFactBtn.addEventListener('click', handleLoadNewFact);
