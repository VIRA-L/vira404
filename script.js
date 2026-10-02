/* ==========================================================
 * VIRA404 — Application script
 * ========================================================== */

/* ==========================================================
 * 1 - ÉTAT GLOBAL + CACHE DOM
 * ========================================================== */

const appState = {
    parsedConfig: null,
    currentLang: localStorage.getItem('userLang') || 'EN',
    catalogueTracks: [],
    totalRadioDuration: 0,
    currentRadioTrackIndex: -1,
    radioSrtData: [],
    radioInterval: null,
    countdownInterval: null,
    featuredAudio: null,
    radioAudio: null,
    featuredSource: null,
    radioSource: null,
};

const dom = {};

function cacheDom() {
    const ids = [
        'btn-lang-en',
        'btn-lang-ru',
        'featured-track-title',
        'featured-caption',
        'featured-artwork-container',
        'featured-date',
        'featured-audio',
        'feat-play',
        'feat-rewind',
        'feat-forward',
        'feat-loop',
        'feat-seek',
        'feat-volume',
        'featured-title-header',
        'working-title',
        'working-caption1',
        'working-caption2',
        'working-artwork-container',
        'landing-title',
        'landing-subtitle',
        'landing-caption1',
        'landing-caption2',
        'landing-caption3',
        'landing-links',
        'pave-landing',
        'radio-audio',
        'radio-toggle-btn',
        'radio-badge',
        'radio-title-header',
        'radio-cover-img',
        'radio-download-btn',
        'radio-track-title',
        'radio-track-info',
        'radio-album-name',
        'radio-album-img',
        'radio-lyrics-container',
        'countdown-timer',
        'retro-game-layer',
        'retro-paddle',
    ];

    ids.forEach((id) => {
        dom[id] = document.getElementById(id);
    });

    dom.gridContainer = document.querySelector('.grid-container');
}

function refreshDomCache() {
    cacheDom();
}

function setCachedElement(id, element) {
    dom[id] = element;
    return element;
}

/* ==========================================================
 * 2 - UTILITAIRES GÉNÉRAUX / MÉDIAS
 * ========================================================== */

function setText(element, value = '') {
    if (element) element.innerText = value;
}

function setBackgroundImage(element, url) {
    if (!element || !url) return;

    element.style.backgroundImage = `url('${url}')`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
}

function readStoredVolume(fallback = 0.8) {
    const stored = localStorage.getItem('audioVolume');
    const volume = stored !== null ? parseFloat(stored) : fallback;
    return Number.isFinite(volume) ? volume : fallback;
}

async function resourceExists(url) {
    if (!url) return false;

    try {
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store',
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function resolveFirstAvailable(candidates) {
    for (const candidate of candidates) {
        if (await resourceExists(candidate)) return candidate;
    }
    return null;
}

async function resolveAudioSource(trackName) {
    if (!trackName) return null;

    return resolveFirstAvailable([
        `audio/${trackName}.m4a`,
        `audio/${trackName}.mp3`,
    ]);
}

async function setImageWithFallback(element, primaryUrl, fallbackUrl, requestKey = '') {
    if (!element) return;

    const key = requestKey || primaryUrl || '';
    element.dataset.mediaRequest = key;

    if (await resourceExists(primaryUrl)) {
        if (element.dataset.mediaRequest === key) {
            element.src = primaryUrl;
        }
        return;
    }

    if (fallbackUrl && await resourceExists(fallbackUrl)) {
        if (element.dataset.mediaRequest === key) {
            element.src = fallbackUrl;
        }
    }
}

async function fetchTextResource(path) {
    if (!path) return null;

    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.text();
    } catch {
        return null;
    }
}

function createAudioElement(id, preload = 'none') {
    let audio = dom[id];

    if (!audio) {
        audio = document.createElement('audio');
        audio.id = id;
        audio.preload = preload;
        document.body.appendChild(audio);
    }

    setCachedElement(id, audio);
    return audio;
}

async function askUserForFile(message) {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#222; color:#fff; padding:20px; border:2px solid #ff3333; z-index:9999; text-align:center; font-family:sans-serif;';
        div.innerHTML = `<p style="margin-bottom:10px;">${message}</p><input type="file" id="file-picker">`;
        document.body.appendChild(div);

        const input = div.querySelector('#file-picker');
        if (!input) {
            div.remove();
            resolve('');
            return;
        }

        input.addEventListener('change', (event) => {
            const file = event.target.files[0];

            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                div.remove();
                resolve(e.target.result || '');
            };
            reader.onerror = () => {
                div.remove();
                resolve('');
            };
            reader.readAsText(file);
        });
    });
}

/* ==========================================================
 * 3 - INITIALISATION GLOBALE
 * ========================================================== */

async function initApp() {
    refreshDomCache();

    let configText = '';
    let catalogueText = '';

    try {
        const resConfig = await fetch('Config404.txt');
        if (!resConfig.ok) throw new Error('Config404.txt introuvable');
        configText = await resConfig.text();
    } catch {
        configText = await askUserForFile('Sélectionne ton fichier : Config404.txt');
    }

    if (configText) processConfig(configText);

    try {
        const resCatalogue = await fetch('Catalogue Vira L.txt');
        if (!resCatalogue.ok) throw new Error('Catalogue Vira L.txt introuvable');
        catalogueText = await resCatalogue.text();
    } catch {
        catalogueText = await askUserForFile('Sélectionne ton fichier : Catalogue Vira L.txt');
    }

    if (catalogueText) processCatalogue(catalogueText);

    initHorizontalScroll();
    initActivePlayerRestore();
    initRetroGame();
}

/* ==========================================================
 * 4 - MODULE CONFIGURATION & TRADUCTION
 * ========================================================== */

function processConfig(text) {
    appState.parsedConfig = parseConfigTxt(text);

    bindLanguageButtons();
    renderLanding();
    initFeaturedFromConfig();
    renderWorkingFromConfig();
}

function bindLanguageButtons() {
    if (dom['btn-lang-en']) {
        dom['btn-lang-en'].onclick = () => switchLanguage('EN');
    }

    if (dom['btn-lang-ru']) {
        dom['btn-lang-ru'].onclick = () => switchLanguage('RU');
    }

    updateLanguageButtons();
}

function updateLanguageButtons() {
    if (dom['btn-lang-en']) {
        dom['btn-lang-en'].classList.toggle('active', appState.currentLang === 'EN');
    }

    if (dom['btn-lang-ru']) {
        dom['btn-lang-ru'].classList.toggle('active', appState.currentLang === 'RU');
    }
}

function switchLanguage(lang) {
    if (appState.currentLang === lang) return;

    appState.currentLang = lang;
    localStorage.setItem('userLang', lang);

    updateLanguageButtons();
    renderLanding();
    updateRadioPassiveUI();
}

function renderLanding() {
    const parsedConfig = appState.parsedConfig;
    if (!parsedConfig) return;

    const baseData = parsedConfig.LANDING || {};
    const langData = parsedConfig[`LANDING_${appState.currentLang}`] || {};
    const configLanding = { ...baseData, ...langData };

    setText(dom['landing-title'], configLanding.title || 'VIRA404');

    let subtitleText = configLanding.subtitle || '';
    subtitleText = subtitleText.replace(
        'NoCodeGirl',
        '<span style="color: var(--accent-fuchsia);">No</span><span style="color: var(--accent-teal);">Code</span><span style="color: var(--accent-fuchsia);">Girl</span>'
    );

    if (dom['landing-subtitle']) dom['landing-subtitle'].innerHTML = subtitleText;

    setText(dom['landing-caption1'], configLanding.caption1 || '');
    setText(dom['landing-caption2'], configLanding.caption2 || '');
    setText(dom['landing-caption3'], configLanding.caption3 || '');

    renderLandingLinks(configLanding);
    setBackgroundImage(dom['pave-landing'], configLanding.artwork);
}

function renderLandingLinks(configLanding) {
    const linksBox = dom['landing-links'];
    if (!linksBox) return;

    linksBox.innerHTML = '';
    linksBox.className = 'pave-footer social-grid';

    for (let i = 1; i <= 4; i++) {
        const textLink = configLanding[`link${i}text`];
        const pageLink = configLanding[`link${i}page`];

        if (!textLink || !pageLink) continue;

        const link = document.createElement('a');
        link.href = pageLink;
        link.className = 'social-btn';
        link.target = '_blank';

        const firstChar = Array.from(textLink)[0] || '🔗';

        const iconContainer = document.createElement('span');
        iconContainer.className = 'social-icon';

        const img = document.createElement('img');
        img.alt = textLink;

        // Validation avant affectation : aucun chargement 404 volontaire.
        applyLinkIcon(img, iconContainer, `assets/link${i}.webp`, firstChar);

        const labelSpan = document.createElement('span');
        labelSpan.className = 'social-label';
        labelSpan.innerText = textLink;

        iconContainer.appendChild(img);
        link.appendChild(iconContainer);
        link.appendChild(labelSpan);
        linksBox.appendChild(link);
    }
}

async function applyLinkIcon(img, container, imageUrl, fallbackChar) {
    if (await resourceExists(imageUrl)) {
        img.src = imageUrl;
        return;
    }

    img.remove();
    container.innerText = fallbackChar;
}

function initFeaturedFromConfig() {
    const featured = appState.parsedConfig?.FEATURED || {};

    setText(dom['featured-track-title'], featured.track || '');
    setText(dom['featured-caption'], featured.caption || '');
    setText(dom['featured-date'], featured.date ? `[ ${featured.date} ]` : '');
    setBackgroundImage(dom['featured-artwork-container'], featured.artwork);

    const featuredTrack = featured.track;
    if (!featuredTrack) return;

    const audio = createAudioElement('featured-audio', 'metadata');
    appState.featuredAudio = audio;
    appState.featuredSource = null;
    audio.volume = readStoredVolume(parseFloat(dom['feat-volume']?.value) || 0.8);

    initializeFeaturedSource(featuredTrack, true);
    bindFeaturedControls(audio);
}

async function initializeFeaturedSource(trackName, tryAutoplay = false) {
    const source = await resolveAudioSource(trackName);
    const audio = appState.featuredAudio || dom['featured-audio'];

    if (!audio || !source) return false;

    appState.featuredSource = source;
    audio.src = source;

    if (tryAutoplay) {
        audio.play().catch(() => {
            // Le navigateur peut bloquer l'autoplay : le lecteur reste disponible au clic.
        });
    }

    return true;
}

function bindFeaturedControls(audio) {
    if (!audio) return;

    if (dom['feat-play']) {
        dom['feat-play'].onclick = () => {
            if (audio.paused) {
                startFeaturedAudio();
            } else {
                stopFeaturedAudio();
            }
        };
    }

    if (dom['feat-rewind']) {
        dom['feat-rewind'].onclick = () => {
            audio.currentTime = Math.max(0, audio.currentTime - 10);
        };
    }

    if (dom['feat-forward']) {
        dom['feat-forward'].onclick = () => {
            audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);
        };
    }

    if (dom['feat-loop']) {
        const savedLoop = localStorage.getItem('audioLoop') === 'true';
        audio.loop = savedLoop;
        dom['feat-loop'].classList.toggle('active', audio.loop);

        dom['feat-loop'].onclick = () => {
            audio.loop = !audio.loop;
            dom['feat-loop'].classList.toggle('active', audio.loop);
            localStorage.setItem('audioLoop', audio.loop);
        };
    }

    if (dom['feat-seek']) {
        audio.ontimeupdate = () => {
            if (audio.duration) {
                dom['feat-seek'].value = (audio.currentTime / audio.duration) * 100;
            }
        };

        dom['feat-seek'].oninput = () => {
            if (audio.duration) {
                audio.currentTime = (dom['feat-seek'].value / 100) * audio.duration;
            }
        };
    }

    if (dom['feat-volume']) {
        dom['feat-volume'].value = audio.volume;
        dom['feat-volume'].oninput = () => {
            const volume = parseFloat(dom['feat-volume'].value);
            audio.volume = Number.isFinite(volume) ? volume : 0.8;
            if (appState.radioAudio) appState.radioAudio.volume = audio.volume;
            localStorage.setItem('audioVolume', audio.volume);
        };
    }
}

function renderWorkingFromConfig() {
    const working = appState.parsedConfig?.WORKING || {};

    setText(dom['working-title'], working.title || '');
    setText(dom['working-caption1'], working.caption1 || '');
    setText(dom['working-caption2'], working.caption2 || '');
    setBackgroundImage(dom['working-artwork-container'], working.artwork);

    if (working.date) initCountdown(working.date);
}

function parseConfigTxt(text) {
    const data = {};
    let currentSection = null;
    const lines = text.split('\n');

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.substring(1, line.length - 1);
            data[currentSection] = {};
            continue;
        }

        if (currentSection && line.includes('=')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();

            value = value
                .replace(/\s*::.*$/, '')
                .replace(/^["'](.*)["']$/, '$1')
                .replace(/\\n/g, '\n');

            data[currentSection][key] = value;
        }
    }

    return data;
}

/* ==========================================================
 * 5 - MODULE PAVÉ 3 — FEATURED AUDIO
 * ========================================================== */

async function startFeaturedAudio() {
    const audio = appState.featuredAudio || dom['featured-audio'];
    const playBtn = dom['feat-play'];
    const featTitle = dom['featured-title-header'];

    if (featTitle) featTitle.classList.add('pulsing-text');
    if (!audio) return;

    // Coupe proprement la radio avant de lancer le Featured.
    stopRadioAudio();

    if (!audio.src && appState.parsedConfig?.FEATURED?.track) {
        await initializeFeaturedSource(appState.parsedConfig.FEATURED.track, false);
    }

    audio.play().then(() => {
        if (playBtn) {
            playBtn.classList.add('active');
            playBtn.innerHTML = '❚❚';
        }
        localStorage.setItem('activePlayer', 'featured');
    }).catch(() => {
        // Lecture refusée ou ressource indisponible : pas d'erreur console artificielle.
    });
}

function stopFeaturedAudio() {
    const audio = appState.featuredAudio || dom['featured-audio'];
    const playBtn = dom['feat-play'];
    const featTitle = dom['featured-title-header'];

    if (featTitle) featTitle.classList.remove('pulsing-text');
    if (audio) audio.pause();

    if (playBtn) {
        playBtn.classList.remove('active');
        playBtn.innerHTML = '▶';
    }

    if (localStorage.getItem('activePlayer') === 'featured') {
        localStorage.removeItem('activePlayer');
    }
}

/* ==========================================================
 * 6 - MODULE PAVÉ 2 — RADIO / CATALOGUE / LECTURE / CONTRÔLES
 * ========================================================== */

function processCatalogue(text) {
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

    const tempTracks = [];

    for (const line of lines) {
        const parsed = parseCatalogueLine(line);
        if (parsed) tempTracks.push(parsed);
    }

    appState.catalogueTracks = tempTracks.map((track, index) => {
        const endSec = index < tempTracks.length - 1
            ? tempTracks[index + 1].startSec
            : track.startSec + track.durationSec;

        return { ...track, endSec };
    });

    appState.currentRadioTrackIndex = -1;

    if (appState.catalogueTracks.length === 0) return;

    appState.totalRadioDuration = appState.catalogueTracks[appState.catalogueTracks.length - 1].endSec;

    initRadioControls();
    updateRadioPassiveUI();

    if (appState.radioInterval) clearInterval(appState.radioInterval);
    appState.radioInterval = setInterval(updateRadioPassiveUI, 1000);
}

function parseTimeToSec(str) {
    if (!str) return 0;

    const parts = str.split(':').map(Number);

    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];

    return 0;
}

function parseCatalogueLine(line) {
    // Format conservé : "00:00:00 / Titre / Album / Année / Durée"
    const parts = line.split(' / ').map((part) => part.trim());
    if (parts.length < 2) return null;

    const startStr = parts[0];
    const rightSide = parts[1];
    const subParts = rightSide.split('/').map((part) => part.trim());

    if (subParts.length < 4) return null;

    const fullName = subParts[0];
    const album = subParts[1];
    const year = subParts[2];
    const durStr = subParts[3];

    const startSec = parseTimeToSec(startStr);
    const durationSec = parseTimeToSec(durStr);

    const trackMatch = fullName.match(/^(\d{2})-/);
    const trackNum = trackMatch ? trackMatch[1] : null;

    let cleanTitle = fullName.replace(/^\d{2}-/, '').split('—')[0].trim();
    cleanTitle = cleanTitle.replace(/\[.*?\]/g, '').trim();

    const isSingle = !album || album.toLowerCase() === 'single';

    return {
        startSec,
        durationSec,
        fullName,
        cleanTitle,
        trackNum,
        album: isSingle ? null : album,
        year,
        isSingle,
    };
}

function getLiveRadioState() {
    const { catalogueTracks, totalRadioDuration } = appState;

    if (!catalogueTracks.length || !totalRadioDuration) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const loopSec = nowSec % totalRadioDuration;

    let index = catalogueTracks.findIndex(
        (track) => loopSec >= track.startSec && loopSec < track.endSec
    );

    if (index === -1) index = 0;

    const track = catalogueTracks[index];
    const offset = loopSec - track.startSec;
    const remaining = track.endSec - loopSec;

    return { trackIndex: index, track, offset, remaining };
}

function updateRadioPassiveUI() {
    const state = getLiveRadioState();
    if (!state) return;

    const { trackIndex, track, offset } = state;

    if (trackIndex !== appState.currentRadioTrackIndex) {
        appState.currentRadioTrackIndex = trackIndex;

        setText(dom['radio-track-title'], track.cleanTitle);

        if (dom['radio-track-info']) {
            const trackPrefix = appState.currentLang === 'RU' ? 'трек' : 'Track';
            dom['radio-track-info'].innerText = track.trackNum && !track.isSingle
                ? `${trackPrefix} ${track.trackNum}, ${track.year}`
                : track.year;
        }

        setText(dom['radio-album-name'], track.isSingle ? 'Single' : track.album);

        resolveRadioDownload(track);
        updateRadioArtwork(track);
        loadRadioLyrics(track.fullName);
    }

    const radioAudio = appState.radioAudio || dom['radio-audio'];
    const activeTime = radioAudio && !radioAudio.paused
        ? radioAudio.currentTime
        : offset;

    syncRadioLyrics(activeTime);
}

async function resolveRadioDownload(track) {
    const downloadBtn = dom['radio-download-btn'];
    if (!downloadBtn) return;

    const source = await resolveAudioSource(track.fullName);

    // Le catalogue peut changer pendant la vérification réseau : ne pas réinjecter une ancienne piste.
    if (appState.catalogueTracks[appState.currentRadioTrackIndex] !== track) return;

    if (source) {
        downloadBtn.href = source;
    } else {
        downloadBtn.removeAttribute('href');
    }
}

async function updateRadioArtwork(track) {
    const coverImg = dom['radio-cover-img'];
    const albumImg = dom['radio-album-img'];

    if (coverImg) {
        await setImageWithFallback(
            coverImg,
            `covers/${track.fullName}.webp`,
            'covers/00a-track-nocode.webp',
            `track:${track.fullName}`
        );
    }

    if (albumImg) {
        const primary = track.isSingle
            ? 'covers/00a-album-nocode.webp'
            : `covers/00-${track.album}.webp`;

        await setImageWithFallback(
            albumImg,
            primary,
            'covers/00a-album-nocode.webp',
            `album:${track.fullName}`
        );
    }
}

function initRadioControls() {
    const audio = createAudioElement('radio-audio', 'none');
    appState.radioAudio = audio;
    audio.volume = readStoredVolume();

    const playBtn = dom['radio-toggle-btn'];

    if (playBtn) {
        playBtn.onclick = (e) => {
            e.preventDefault();

            if (audio.paused) {
                startRadioAudio();
            } else {
                stopRadioAudio();
            }
        };
    }

    audio.onended = () => {
        startRadioAudio();
    };

    if (dom['feat-volume']) {
        dom['feat-volume'].value = audio.volume;
    }
}

async function startRadioAudio() {
    const audio = appState.radioAudio || dom['radio-audio'];
    const playBtn = dom['radio-toggle-btn'];
    const badgeOnAir = dom['radio-badge'];
    const state = getLiveRadioState();
    const radioTitle = dom['radio-title-header'];

    if (radioTitle) radioTitle.classList.add('pulsing-text');
    if (!audio || !state) return;

    // Coupe proprement le player Featured avant de lancer la radio.
    stopFeaturedAudio();

    const source = await resolveAudioSource(state.track.fullName);
    if (!source) return;

    appState.radioSource = source;
    audio.src = source;
    audio.volume = readStoredVolume();
    audio.currentTime = state.offset;

    audio.play().then(() => {
        if (playBtn) {
            playBtn.classList.add('playing');
            playBtn.innerHTML = '❚❚';
        }

        if (badgeOnAir) badgeOnAir.classList.add('active');
        localStorage.setItem('activePlayer', 'radio');

        enableRadioDownload();
    }).catch(() => {
        // Lecture bloquée ou ressource devenue indisponible : aucun fallback onerror nécessaire.
    });
}

function stopRadioAudio() {
    const audio = appState.radioAudio || dom['radio-audio'];
    const playBtn = dom['radio-toggle-btn'];
    const badgeOnAir = dom['radio-badge'];
    const radioTitle = dom['radio-title-header'];

    if (radioTitle) radioTitle.classList.remove('pulsing-text');
    if (audio) audio.pause();

    if (playBtn) {
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '<span style="margin-left: 6px;">▶</span>';
    }

    if (badgeOnAir) badgeOnAir.classList.remove('active');

    if (localStorage.getItem('activePlayer') === 'radio') {
        localStorage.removeItem('activePlayer');
    }

    disableRadioDownload();
}

function enableRadioDownload() {
    const coverImg = dom['radio-cover-img'];
    if (!coverImg) return;

    coverImg.classList.add('downloadable');
    coverImg.removeEventListener('click', triggerRadioDownload);
    coverImg.addEventListener('click', triggerRadioDownload);
}

function disableRadioDownload() {
    const coverImg = dom['radio-cover-img'];
    if (!coverImg) return;

    coverImg.classList.remove('downloadable');
    coverImg.removeEventListener('click', triggerRadioDownload);
}

function triggerRadioDownload(e) {
    e.preventDefault();

    const downloadBtn = dom['radio-download-btn'];
    if (downloadBtn) downloadBtn.click();
}

/* ==========================================================
 * 7 - MODULE PAROLES & SYNCHRONISATION (SRT/TXT)
 * ========================================================== */
/* ==========================================================
 * PARSEUR SRT AVEC REMPLISSAGE AUTOMATIQUE DES BLANCS (🎵🎶)
 * ========================================================== */

function parseSrtTime(timeStr) {
    if (!timeStr) return 0;
    const normalized = timeStr.trim().replace(',', '.');
    const parts = normalized.split(':');
    if (parts.length < 3) return 0;

    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;

    return (hours * 3600) + (minutes * 60) + seconds;
}

function parseSRT(data) {
    if (!data) return [];
    const lines = data.replace(/\r/g, '').split('\n');
    const rawSubtitles = [];
    let currentSub = null;
    let textLines = [];

    // 1. Analyse classique ligne par ligne du SRT
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.includes('-->')) {
            if (currentSub) {
                currentSub.text = textLines.join('<br>');
                rawSubtitles.push(currentSub);
            }
            const parts = line.split('-->');
            currentSub = {
                startSec: parseSrtTime(parts[0]),
                endSec: parseSrtTime(parts[1])
            };
            textLines = [];
        } else if (currentSub && line !== '') {
            const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
            if (nextLine.includes('-->') && /^\d+$/.test(line)) {
                continue;
            }
            textLines.push(line);
        }
    }
    
    if (currentSub) {
        currentSub.text = textLines.join('<br>');
        rawSubtitles.push(currentSub);
    }

    if (rawSubtitles.length === 0) return [];

    // 2. Insertion automatique des blocs "🎵🎶 🎵🎶 🎵🎶" dans les silences
    const subtitles = [];
    const GAP_THRESHOLD = 3.0; // Seuil en secondes : si un blanc dépasse 3s, on met des notes

    // Si l'intro de la chanson dépasse le seuil avant la première parole
    if (rawSubtitles[0].startSec > GAP_THRESHOLD) {
        subtitles.push({
            startSec: 0,
            endSec: rawSubtitles[0].startSec,
            text: "🎵🎶 🎵🎶 🎵🎶"
        });
    }

    // Parcours des blocs pour combler les trous entre les phrases
    for (let i = 0; i < rawSubtitles.length; i++) {
        subtitles.push(rawSubtitles[i]);

        if (i + 1 < rawSubtitles.length) {
            const currentEnd = rawSubtitles[i].endSec;
            const nextStart = rawSubtitles[i + 1].startSec;
            const gap = nextStart - currentEnd;

            if (gap >= GAP_THRESHOLD) {
                subtitles.push({
                    startSec: currentEnd,
                    endSec: nextStart,
                    text: "🎵🎶 🎵🎶 🎵🎶"
                });
            }
        }
    }

    return subtitles;
}

/**  * Chargeur avec distinction explicite entre SRT (horodaté) et TXT (brut) */
async function loadRadioLyrics(trackName) {
    const srtText = await fetchTextResource(`lyrics/${trackName}.srt`);

    if (srtText !== null) {
        const parsed = parseSRT(srtText);
        if (parsed.length > 0) {
            appState.radioSrtData = parsed;
            return;
        }
    }

    // Fichier TXT de la piste : on NE PASSE PAS dans parseSRT() !
    const txtText = await fetchTextResource(`lyrics/${trackName}.txt`);

    if (txtText !== null) {
        appState.radioSrtData = [
            {
                startSec: 0,
                endSec: 999999,
                text: txtText.trim().replace(/\n/g, '<br>'),
            },
        ];
        return;
    }

    // Fichier TXT de secours global
    const fallbackText = await fetchTextResource('lyrics/00a-lyrics-nocode.txt');

    if (fallbackText !== null) {
        appState.radioSrtData = [
            {
                startSec: 0,
                endSec: 999999,
                text: fallbackText.trim().replace(/\n/g, '<br>'),
            },
        ];
        return;
    }

    appState.radioSrtData = [{
        startSec: 0,
        endSec: 999999,
        text: '---',
    }];

    if (dom['radio-lyrics-container']) {
        dom['radio-lyrics-container'].innerHTML = '<span class="no-lyrics">---</span>';
    }
}

/**  * Synchronisation dynamique avec extraction des 5 lignes  */
function syncRadioLyrics(currentTime) {
    const container = dom['radio-lyrics-container'];
    if (!container || !appState.radioSrtData || !appState.radioSrtData.length) return;

    // Cas 1 : Texte brut complet (TXT)
    if (appState.radioSrtData.length === 1 && appState.radioSrtData[0].startSec === 0 && appState.radioSrtData[0].endSec === 999999) {
        
        // CORRECTION PB 2 : On rend le 'lastState' unique pour chaque piste
        const stateId = 'txt-plain-' + appState.currentRadioTrackIndex; 
        
        if (container.dataset.lastState !== stateId) {
            container.dataset.lastState = stateId;
            container.innerHTML = `<div class="srt-line srt-plain">${appState.radioSrtData[0].text}</div>`;
            
            // CORRECTION PB 1.1 et 1.2 : On force l'alignement en haut pour libérer le scroll
            container.style.justifyContent = 'flex-start'; 
            container.scrollTop = 0; // Remonte l'ascenseur au changement de piste
        }
        return;
    }

    // Cas 2 : SRT - Recherche de l'index actif
    let activeIndex = appState.radioSrtData.findIndex(
        (sub) => currentTime >= sub.startSec && currentTime <= sub.endSec
    );

    let isCurrentlyActive = true;

    if (activeIndex === -1) {
        isCurrentlyActive = false;
        const nextIndex = appState.radioSrtData.findIndex(sub => sub.startSec > currentTime);
        if (nextIndex !== -1) {
            activeIndex = nextIndex; 
        } else {
            activeIndex = appState.radioSrtData.length - 1;
        }
    }

    const stateId = `${activeIndex}_${isCurrentlyActive}`;
    if (container.dataset.lastState === stateId) return;
    container.dataset.lastState = stateId;

    // RESTAURATION : On remet le centrage vertical pour le mode Karaoké/SRT
    container.style.justifyContent = 'center';

    const prev2 = activeIndex - 2 >= 0 ? appState.radioSrtData[activeIndex - 2].text : '';
    const prev1 = activeIndex - 1 >= 0 ? appState.radioSrtData[activeIndex - 1].text : '';
    const activeText = appState.radioSrtData[activeIndex].text;
    const next1 = activeIndex + 1 < appState.radioSrtData.length ? appState.radioSrtData[activeIndex + 1].text : '';
    const next2 = activeIndex + 2 < appState.radioSrtData.length ? appState.radioSrtData[activeIndex + 2].text : '';

    let html = '';
    if (prev2) html += `<div class="srt-line srt-prev srt-prev-2">${prev2}</div>`;
    if (prev1) html += `<div class="srt-line srt-prev srt-prev-1">${prev1}</div>`;

    html += `<div class="srt-line ${isCurrentlyActive ? 'srt-active' : 'srt-waiting'}">${activeText}</div>`;

    if (next1) html += `<div class="srt-line srt-next srt-next-1">${next1}</div>`;
    if (next2) html += `<div class="srt-line srt-next srt-next-2">${next2}</div>`;

    container.innerHTML = html;
}

/* ==========================================================
 * 8 - MODULES ANNEXES — COMPTE À REBOURS / SCROLL / MINI-JEU
 * ========================================================== */

function initCountdown(dateString) {
    const timerElem = dom['countdown-timer'];
    if (!timerElem) return;

    if (appState.countdownInterval) {
        clearInterval(appState.countdownInterval);
        appState.countdownInterval = null;
    }

    function updateTimer() {
        const now = new Date();
        const target = new Date(dateString);

        if (Number.isNaN(target.getTime()) || target <= now) {
            timerElem.innerText = 'ONLINE NOW';
            return;
        }

        let years = target.getFullYear() - now.getFullYear();
        let months = target.getMonth() - now.getMonth();
        let days = target.getDate() - now.getDate();
        let hours = target.getHours() - now.getHours();
        let minutes = target.getMinutes() - now.getMinutes();
        let seconds = target.getSeconds() - now.getSeconds();

        if (seconds < 0) { seconds += 60; minutes--; }
        if (minutes < 0) { minutes += 60; hours--; }
        if (hours < 0) { hours += 24; days--; }

        if (days < 0) {
            const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
            days += prevMonth.getDate();
            months--;
        }

        if (months < 0) {
            months += 12;
            years--;
        }

        const units = [
            { val: years, suffix: 'y' },
            { val: months, suffix: 'm' },
            { val: days, suffix: 'd' },
            { val: hours, suffix: 'h' },
            { val: minutes, suffix: 'm' },
            { val: seconds, suffix: 's' },
        ];

        const firstNonZeroIndex = units.findIndex((unit) => unit.val > 0);

        if (firstNonZeroIndex === -1) {
            timerElem.innerText = 'ONLINE NOW';
            return;
        }

        const activeUnits = units.slice(firstNonZeroIndex);
        const formatted = activeUnits
            .map((unit, index) => {
                const valStr = index > 0 && unit.val < 10
                    ? `0${unit.val}`
                    : `${unit.val}`;
                return `${valStr}${unit.suffix}`;
            })
            .join(' ');

        timerElem.innerText = formatted;
    }

    updateTimer();
    appState.countdownInterval = setInterval(updateTimer, 1000);
}

function initHorizontalScroll() {
    const gridContainer = dom.gridContainer;
    if (!gridContainer) return;

    gridContainer.addEventListener('wheel', (evt) => {
        if (gridContainer.scrollWidth > gridContainer.clientWidth) {
            evt.preventDefault();
            gridContainer.scrollLeft += evt.deltaY;
        }
    }, { passive: false });
}

function initActivePlayerRestore() {
    const lastPlayer = localStorage.getItem('activePlayer');

    if (lastPlayer === 'radio') {
        setTimeout(() => {
            if (typeof startRadioAudio === 'function') {
                startRadioAudio();
            }
        }, 500);
    }
}

function initRetroGame() {
    const layer = dom['retro-game-layer'];
    const paddle = dom['retro-paddle'];

    if (!paddle || !layer) return;

    const emojis = ['🚀', '🔥', '☣️', '👎', '⚡', '🧬', '💔', '🧲', '🐧', '⏳', '💜', '💖', '💕'];

    let posX = layer.clientWidth / 2;
    let direction = 2;
    let fireInterval = null;

    function movePaddle() {
        const parentWidth = layer.clientWidth;
        const paddleWidth = paddle.offsetWidth;

        posX += direction;

        if (posX - paddleWidth / 2 <= 0 || posX + paddleWidth / 2 >= parentWidth) {
            direction *= -1;
        }

        paddle.style.left = `${posX}px`;
        requestAnimationFrame(movePaddle);
    }

    function shootEmoji() {
        const count = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < count; i++) {
            const bullet = document.createElement('div');
            bullet.className = 'retro-bullet';
            bullet.textContent = emojis[Math.floor(Math.random() * emojis.length)];

            const paddleRect = paddle.getBoundingClientRect();
            const layerRect = layer.getBoundingClientRect();

            const relativeLeft =
                (paddleRect.left - layerRect.left) +
                (paddleRect.width / 2) +
                (Math.random() * 60 - 30);

            bullet.style.left = `${relativeLeft}px`;
            bullet.style.bottom = '230px';
            layer.appendChild(bullet);

            setTimeout(() => bullet.remove(), 1200);
        }
    }

    function startFiring(e) {
        e.stopPropagation();
        if (fireInterval) return;

        shootEmoji();
        fireInterval = setInterval(shootEmoji, 120);
        paddle.style.boxShadow = '0 0 30px var(--accent-fuchsia)';
    }

    function stopFiring() {
        if (!fireInterval) return;

        clearInterval(fireInterval);
        fireInterval = null;
        paddle.style.boxShadow = '0 0 10px var(--accent-teal)';
        paddle.style.borderColor = 'var(--accent-fuchsia)';
    }

    requestAnimationFrame(movePaddle);

    paddle.addEventListener('mousedown', startFiring);
    paddle.addEventListener('mouseup', stopFiring);
    paddle.addEventListener('mouseleave', stopFiring);

    paddle.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        if (fireInterval) return;

        shootEmoji();
        fireInterval = setInterval(shootEmoji, 120);
    });

    paddle.addEventListener('touchend', stopFiring);
}

/* ==========================================================
 * 9 - ÉCOUTEUR DOMCONTENTLOADED UNIQUE
 * ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Force la mise à jour complète de la radio (piste, UI, paroles)
        // au moment exact où l'utilisateur revient sur la page.
        if (typeof updateRadioPassiveUI === 'function') {
            updateRadioPassiveUI();
        }
    }
});