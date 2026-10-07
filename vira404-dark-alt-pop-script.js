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
    radioStartInProgress: false,
    radioActionTrack: null,
    radioDownloadCooldownInterval: null,
};

const RADIO_DOWNLOAD_TIMESTAMP_KEY = 'trackDownloaded';
const RADIO_DOWNLOAD_TRACK_KEY = 'trackDownloadedTrack';
const RADIO_DOWNLOAD_COOLDOWN_MS = 30_000;
const RADIO_TELEGRAM_GROUP_URL = 'https://t.me/nocodefans';
const RADIO_DOWNLOAD_ACTION_IDS = [
    'radio-download-actions',
    'radio-direct-download',
    'radio-direct-countdown',
    'radio-download-share',
    'radio-download-join',
    'radio-action-status',
];

const dom = {};

function cacheDom() {
    const ids = [
        'btn-lang-en',
        'btn-lang-ru',
        'featured-track-title',
        'featured-caption',
        'featured-cover-img',
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
        'working-cover-img',
        'landing-cover-img',
        'landing-title',
        'landing-subtitle',
        'radio-audio',
        'radio-toggle-btn',
        'radio-title-header',
        'radio-cover-img',
        'radio-download-btn',
        ...RADIO_DOWNLOAD_ACTION_IDS,
        'radio-track-title',
        'radio-track-info',
        'radio-album-name',
        'radio-album-img',
        'radio-lyrics-container',
        'radio-playlist-drawer',
        'radio-playlist-handle',
        'radio-playlist-tracks',
        'countdown-timer',
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

function highlightNoCodeGirlText(root) {
    const textNodes = [];
    if (root.nodeType === Node.TEXT_NODE) {
        textNodes.push(root);
    } else if (root.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) textNodes.push(node);
    }

    for (const textNode of textNodes) {
        const parent = textNode.parentElement;
        const text = textNode.nodeValue;
        if (!parent || parent.closest('.nocodegirl-accent, .nocodegirl-code, script, style, noscript, textarea')
            || !/NoCodeGirl/i.test(text)) {
            continue;
        }

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        for (const match of text.matchAll(/NoCodeGirl/gi)) {
            fragment.append(document.createTextNode(text.slice(lastIndex, match.index)));
            const name = match[0];
            for (const [part, className] of [
                [name.slice(0, 2), 'nocodegirl-accent'],
                [name.slice(2, 6), 'nocodegirl-code'],
                [name.slice(6), 'nocodegirl-accent'],
            ]) {
                const highlight = document.createElement('span');
                highlight.className = className;
                highlight.textContent = part;
                fragment.append(highlight);
            }
            lastIndex = match.index + match[0].length;
        }
        fragment.append(document.createTextNode(text.slice(lastIndex)));
        parent.replaceChild(fragment, textNode);
    }
}

function highlightNoCodeGirlContent() {
    document.querySelectorAll('.pave-header, .pave-footer')
        .forEach((root) => highlightNoCodeGirlText(root));
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

async function resolveAudioSource(trackOrName) {
    const track = typeof trackOrName === 'string'
        ? appState.catalogueTracks.find((item) => item.fullName === trackOrName)
        : trackOrName;
    const trackName = track ? track.fullName : trackOrName;
    if (!trackName) return null;

    if (track?.audioExt) {
        return `audio/${track.fullName}.${track.audioExt}`;
    }

    return resolveFirstAvailable([
        `audio/${trackName}.m4a`,
        `audio/${trackName}.mp3`,
    ]);
}

function setImageWithFallback(element, primaryUrl, fallbackUrl, requestKey = '') {
    if (!element || !primaryUrl) return;

    const key = requestKey || primaryUrl || '';
    element.dataset.mediaRequest = key;
    element.onerror = () => {
        if (element.dataset.mediaRequest !== key) return;
        element.onerror = null;
        if (fallbackUrl) element.src = fallbackUrl;
    };
    element.src = primaryUrl;
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

/* ==========================================================
 * 3 - INITIALISATION GLOBALE
 * ========================================================== */

async function initApp() {
    refreshDomCache();

    let configText = '';
    let catalogueText = '';

    try {
        const resConfig = await fetch('nocode-vira404-config.txt');
        if (!resConfig.ok) throw new Error('nocode-vira404-config.txt introuvable');
        configText = await resConfig.text();
    } catch (error) {
        console.error('Impossible de charger nocode-vira404-config.txt.', error);
    }

    if (configText) {
        processConfig(configText);
    } else {
        highlightNoCodeGirlContent();
    }

    try {
        const resCatalogue = await fetch('Catalogue Vira L.txt');
        if (!resCatalogue.ok) throw new Error('Catalogue Vira L.txt introuvable');
        catalogueText = await resCatalogue.text();
    } catch (error) {
        console.error('Impossible de charger Catalogue Vira L.txt.', error);
    }

    if (catalogueText) processCatalogue(catalogueText);

    initHorizontalScroll();

    restoreLastPlayer();
}

function restoreLastPlayer() {
    const lastPlayer = localStorage.getItem('activePlayer');
    setTimeout(() => {
        if (lastPlayer === 'radio' && appState.catalogueTracks.length > 0) {
            startRadioAudio();
        } else if (lastPlayer === 'featured' && appState.parsedConfig?.FEATURED?.track) {
            startFeaturedAudio();
        }
    }, 500);
}

window.addEventListener('vira404:manual-file-loaded', (event) => {
    const { kind, text } = event.detail || {};

    if (typeof text !== 'string' || !text.trim()) {
        console.error('Le fichier manuel sélectionné est vide ou illisible.');
        return;
    }

    if (kind === 'config') {
        processConfig(text);
    } else if (kind === 'catalogue') {
        processCatalogue(text);
        if (appState.catalogueTracks.length === 0) {
            console.error('Le catalogue manuel ne contient aucune piste lisible.');
        }
    } else {
        console.error('Type de fichier manuel VIRA404 inconnu.', kind);
        return;
    }

    restoreLastPlayer();
});

/* ==========================================================
 * 4 - MODULE CONFIGURATION & TRADUCTION
 * ========================================================== */

function processConfig(text) {
    appState.parsedConfig = parseConfigTxt(text);

    bindLanguageButtons();
    initFeaturedFromConfig();
    renderWorkingFromConfig();
    highlightNoCodeGirlContent();
}

function bindLanguageButtons() {
    if (dom['btn-lang-en']) {
        dom['btn-lang-en'].onclick = () => switchLanguage('EN');
    }

    if (dom['btn-lang-ru']) {
        dom['btn-lang-ru'].onclick = () => switchLanguage('RU');
    }

    updateLanguageUX();
}

function updateLanguageUX() {
    document.documentElement.lang = appState.currentLang.toLowerCase();

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

    updateLanguageUX();
    updateRadioPassiveUI();
    renderRadioPlaylistDrawer();
    highlightNoCodeGirlContent();
}

function initFeaturedFromConfig() {
    const featured = appState.parsedConfig?.FEATURED || {};

    setText(dom['featured-track-title'], featured.track || '');
    const featuredCaptionEn = dom['featured-caption']?.querySelector('.lang-en');
    const featuredCaptionRu = dom['featured-caption']?.querySelector('.lang-ru');
    if (featured.caption_en && featuredCaptionEn) featuredCaptionEn.innerText = featured.caption_en;
    if (featured.caption_ru && featuredCaptionRu) featuredCaptionRu.innerText = featured.caption_ru;
    setText(dom['featured-date'], featured.date ? `[ ${featured.date} ]` : '');
    if (dom['featured-cover-img']) dom['featured-cover-img'].src = featured.artwork || '';
    const featuredTrack = featured.track;
    if (!featuredTrack) return;

    const audio = createAudioElement('featured-audio', 'metadata');
    appState.featuredAudio = audio;
    audio.volume = readStoredVolume(parseFloat(dom['feat-volume']?.value) || 0.8);

    initializeFeaturedSource(featuredTrack, true); //MODIF IA TRUE FALSE
    bindFeaturedControls(audio);
}

async function initializeFeaturedSource(trackName, tryAutoplay = false) {
    const source = await resolveAudioSource(trackName);
    const audio = appState.featuredAudio || dom['featured-audio'];

    if (!audio || !source) return false;

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

    const setLocalizedText = (element, language, value) => {
        const localizedElement = element?.querySelector(`.lang-${language}`);
        if (value && localizedElement) {
            localizedElement.textContent = value.replace(/<br\s*\/?>/gi, '\n');
        }
    };

    setLocalizedText(dom['working-title'], 'en', working.title_en);
    setLocalizedText(dom['working-title'], 'ru', working.title_ru);
    setLocalizedText(dom['working-caption1'], 'en', working.caption1_en);
    setLocalizedText(dom['working-caption1'], 'ru', working.caption1_ru);
    setLocalizedText(dom['working-caption2'], 'en', working.caption2_en);
    setLocalizedText(dom['working-caption2'], 'ru', working.caption2_ru);
    if (working.artwork && dom['working-cover-img']) {
        dom['working-cover-img'].src = working.artwork;
    }

    if (working.date) {
        initCountdown(working.date);
    }
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

    initRadioPlaylistDrawer();
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
    const audioExt = subParts[4] ? subParts[4].toLowerCase() : 'm4a';
    const lyricsExt = subParts[5] ? subParts[5].toLowerCase() : 'srt';
    const imageStatus = subParts[6] ? subParts[6].toUpperCase() : 'IMG';
    if (!['m4a', 'mp3'].includes(audioExt)) return null;
    if (!['srt', 'txt', 'none'].includes(lyricsExt)) return null;
    if (!['IMG', '-IMG'].includes(imageStatus)) return null;
    const hasImg = imageStatus === 'IMG';

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
        audioExt,
        lyricsExt,
        hasImg,
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
        const previousTrack = appState.catalogueTracks[appState.currentRadioTrackIndex];
        appState.currentRadioTrackIndex = trackIndex;
        onRadioTrackChange(track, previousTrack);

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
        loadRadioLyrics(track);
        renderRadioPlaylistDrawer();
    }

    const radioAudio = appState.radioAudio || dom['radio-audio'];
    const activeTime = radioAudio && !radioAudio.paused
        ? radioAudio.currentTime
        : offset;

    syncRadioLyrics(activeTime);
    updateRadioDownloadCooldown(track);
}

function initRadioPlaylistDrawer() {
    const drawer = dom['radio-playlist-drawer'];
    const handle = dom['radio-playlist-handle'];
    if (!drawer || !handle) return;

    let pointerStartY = 0;
    let pointerActive = false;
    let dragged = false;
    let startExpanded = false;
    let startVisibleCount = 3;

    const setDrawerState = (expanded, visibleCount = 3) => {
        const previousVisibleCount = Number(drawer.dataset.visibleCount) || 3;
        drawer.classList.toggle('is-open', expanded);
        drawer.dataset.visibleCount = String(visibleCount);
        handle.setAttribute('aria-expanded', String(expanded));
        if (previousVisibleCount !== visibleCount) renderRadioPlaylistDrawer();
    };

    drawer.addEventListener('pointerdown', (event) => {
        pointerActive = true;
        pointerStartY = event.clientY;
        dragged = false;
        startExpanded = drawer.classList.contains('is-open');
        startVisibleCount = Number(drawer.dataset.visibleCount) || 3;
        drawer.setPointerCapture(event.pointerId);
    });

    drawer.addEventListener('pointermove', (event) => {
        if (!pointerActive) return;
        const dragDistance = event.clientY - pointerStartY;
        if (Math.abs(dragDistance) > 8) dragged = true;
        if (!dragged) return;

        if (startExpanded && dragDistance < -24) {
            setDrawerState(false);
        } else if (dragDistance > 108) {
            setDrawerState(true, 5);
        } else if (dragDistance > 24 || (startExpanded && startVisibleCount === 5)) {
            setDrawerState(true, 3);
        }
    });

    drawer.addEventListener('pointerup', (event) => {
        if (!dragged) {
            setDrawerState(!startExpanded, 3);
        } else {
            const dragDistance = event.clientY - pointerStartY;
            if (dragDistance > 108) setDrawerState(true, 5);
            else if (dragDistance > 24) setDrawerState(true, 3);
            else if (dragDistance < -24) setDrawerState(false);
            else setDrawerState(startExpanded, startVisibleCount);
        }
        pointerActive = false;
        dragged = false;
    });

    drawer.addEventListener('pointercancel', () => {
        pointerActive = false;
        dragged = false;
        setDrawerState(startExpanded, startVisibleCount);
    });

    handle.addEventListener('click', (event) => {
        if (event.detail === 0) setDrawerState(!drawer.classList.contains('is-open'), 3);
    });
}

function renderRadioPlaylistDrawer() {
    const list = dom['radio-playlist-tracks'];
    const tracks = appState.catalogueTracks;
    const currentIndex = appState.currentRadioTrackIndex;
    if (!list || !tracks.length || currentIndex < 0) return;

    const visibleCount = Number(dom['radio-playlist-drawer']?.dataset.visibleCount) === 5 ? 5 : 3;
    const halfRange = Math.floor(visibleCount / 2);
    const fragment = document.createDocumentFragment();

    for (let offset = -halfRange; offset <= halfRange; offset += 1) {
        const index = (currentIndex + offset + tracks.length) % tracks.length;
        const track = tracks[index];
        const item = document.createElement('div');
        item.className = `radio-playlist-track${offset === 0 ? ' is-current' : ''}`;
        item.setAttribute('role', 'listitem');
        item.setAttribute('aria-current', String(offset === 0));

        const title = document.createElement('span');
        title.className = 'radio-playlist-title';
        title.textContent = track.cleanTitle
            .replace(/\s+(?:glitchpunk|extended punk|alternative rock|alt rock|unplugged)\b.*$/i, '')
            .trim();

        const duration = document.createElement('span');
        duration.className = 'radio-playlist-duration';
        duration.textContent = formatRadioTrackDuration(track.durationSec);

        const details = document.createElement('span');
        details.className = 'radio-playlist-details';
        const singleLabel = appState.currentLang === 'RU' ? 'Сингл' : 'Single';
        details.textContent = `${track.isSingle ? singleLabel : track.album} · ${track.year}`;

        item.append(title, duration, details);
        fragment.append(item);
    }

    list.replaceChildren(fragment);
}

function formatRadioTrackDuration(durationSec) {
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function resolveRadioDownload(track) {
    const downloadBtn = dom['radio-download-btn'];
    if (!downloadBtn) return;

    const source = await resolveAudioSource(track);

    // Le catalogue peut changer pendant la vérification réseau : ne pas réinjecter une ancienne piste.
    if (appState.catalogueTracks[appState.currentRadioTrackIndex] !== track) return;

    if (source) {
        downloadBtn.href = source;
    } else {
        downloadBtn.removeAttribute('href');
    }
}

function updateRadioArtwork(track) {
    const coverImg = dom['radio-cover-img'];
    const albumImg = dom['radio-album-img'];

    if (coverImg) {
        const trackCover = track.hasImg
            ? `covers/${track.fullName}.webp`
            : 'covers/00a-track-nocode.webp';
        setImageWithFallback(
            coverImg,
            trackCover,
            track.hasImg ? 'covers/00a-track-nocode.webp' : '',
            `track:${track.fullName}`
        );
    }

    if (albumImg) {
        const primary = track.isSingle
            ? 'covers/00a-album-nocode.webp'
            : `covers/00-${track.album}.webp`;

        setImageWithFallback(
            albumImg,
            primary,
            track.isSingle ? '' : 'covers/00a-album-nocode.webp',
            `album:${track.fullName}`
        );
    }
}

function initRadioControls() {
    const audio = createAudioElement('radio-audio', 'none');
    appState.radioAudio = audio;
    audio.volume = readStoredVolume();
    initRadioActionBar();
    audio.addEventListener('play', () => {
        if (!appState.radioStartInProgress) {
            startRadioAudio();
        }
    });

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
    const state = getLiveRadioState();
    const radioTitle = dom['radio-title-header'];

    if (appState.radioStartInProgress) return;
    appState.radioStartInProgress = true;

    try {
        if (radioTitle) radioTitle.classList.add('pulsing-text');
        if (!audio || !state) return;

        // Coupe proprement le player Featured avant de lancer la radio.
        stopFeaturedAudio();

        const source = await resolveAudioSource(state.track);
        if (!source) return;

        audio.src = source;
        audio.volume = readStoredVolume();
        audio.currentTime = state.offset;

        await audio.play();
        if (playBtn) {
            playBtn.classList.add('playing');
            playBtn.innerHTML = '❚❚';
        }

        localStorage.setItem('activePlayer', 'radio');
        enableRadioDownload();
    } catch {
        // Lecture bloquée ou ressource devenue indisponible : aucun fallback onerror nécessaire.
    } finally {
        appState.radioStartInProgress = false;
    }
}

function stopRadioAudio() {
    const audio = appState.radioAudio || dom['radio-audio'];
    const playBtn = dom['radio-toggle-btn'];
    const radioTitle = dom['radio-title-header'];

    if (radioTitle) radioTitle.classList.remove('pulsing-text');
    if (audio) audio.pause();

    if (playBtn) {
        playBtn.classList.remove('playing');
        playBtn.innerHTML = '<span style="margin-left: 6px;">▶</span>';
    }

    if (localStorage.getItem('activePlayer') === 'radio') {
        localStorage.removeItem('activePlayer');
    }

    disableRadioDownload();
}

function enableRadioDownload() {
    const coverImg = dom['radio-cover-img'];
    if (!coverImg) return;

    coverImg.classList.add('downloadable');
    coverImg.onclick = openRadioDownloadActions;
}

function disableRadioDownload() {
    const coverImg = dom['radio-cover-img'];
    if (!coverImg) return;

    coverImg.classList.remove('downloadable');
    coverImg.onclick = null;
    closeRadioDownloadActions();
}

function initRadioActionBar() {
    const coverImg = dom['radio-cover-img'];
    const directButton = dom['radio-direct-download'];
    const shareButton = dom['radio-download-share'];
    const joinButton = dom['radio-download-join'];
    if (!coverImg || !directButton || !shareButton || !joinButton) return;

    coverImg.setAttribute('role', 'button');
    coverImg.setAttribute('tabindex', '0');
    coverImg.setAttribute('aria-label', appState.currentLang === 'RU'
        ? 'Действия с текущим треком'
        : 'Actions for the currently playing track');
    coverImg.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openRadioDownloadActions(event);
    };

    directButton.onclick = () => {
        const track = getRadioActionTrack();
        if (!track) return;

        const result = beginRadioDownload(track);
        if (result === 'started') {
            closeRadioDownloadActions(true);
        } else if (result === 'unavailable') {
            setRadioActionStatus(appState.currentLang === 'RU'
                ? 'Загрузка этого трека недоступна.'
                : 'Download unavailable for this track.');
        }
    };

    shareButton.onclick = async () => {
        const track = getRadioActionTrack();
        if (!track) return;

        const result = beginRadioDownload(track);
        if (result === 'unavailable') {
            setRadioActionStatus(appState.currentLang === 'RU'
                ? 'Загрузка этого трека недоступна.'
                : 'Download unavailable for this track.');
            return;
        }

        await shareRadioTrack(track);
    };

    joinButton.onclick = () => {
        const track = getRadioActionTrack();
        if (!track) return;

        const result = beginRadioDownload(track);
        if (result === 'unavailable') {
            setRadioActionStatus(appState.currentLang === 'RU'
                ? 'Загрузка этого трека недоступна.'
                : 'Download unavailable for this track.');
            return;
        }

        const message = `Thanks for the download 🤘 — ${getRadioShareTrackTitle(track)}`;
        const telegramUrl = `${RADIO_TELEGRAM_GROUP_URL}?text=${encodeURIComponent(message)}`;
        window.open(telegramUrl, '_blank', 'noopener,noreferrer');
        closeRadioDownloadActions();
    };

    document.addEventListener('pointerdown', (event) => {
        const actionBar = dom['radio-download-actions'];
        if (!actionBar || actionBar.hidden || actionBar.contains(event.target)
            || event.target === coverImg) {
            return;
        }
        closeRadioDownloadActions();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !dom['radio-download-actions']?.hidden) {
            closeRadioDownloadActions(true);
        }
    });

    window.addEventListener('resize', () => closeRadioDownloadActions());
}

function getRadioActionTrack() {
    const track = appState.radioActionTrack;
    if (!track || appState.catalogueTracks[appState.currentRadioTrackIndex] !== track) {
        closeRadioDownloadActions();
        return null;
    }
    return track;
}

function openRadioDownloadActions(event) {
    event.preventDefault();
    const track = appState.catalogueTracks[appState.currentRadioTrackIndex];
    const coverImg = dom['radio-cover-img'];
    const actionBar = dom['radio-download-actions'];
    if (!track || !coverImg || !actionBar || !coverImg.classList.contains('downloadable')) return;

    appState.radioActionTrack = track;
    setRadioActionStatus('');
    actionBar.hidden = false;
    actionBar.classList.add('is-open');
    actionBar.setAttribute('aria-hidden', 'false');

    const coverRect = coverImg.getBoundingClientRect();
    const anchorX = Number.isFinite(event.clientX) && event.clientX > 0
        ? event.clientX
        : coverRect.left + coverRect.width / 2;
    const anchorY = Number.isFinite(event.clientY) && event.clientY > 0
        ? event.clientY
        : coverRect.top;
    const barRect = actionBar.getBoundingClientRect();
    const halfWidth = barRect.width / 2;
    const centerX = Math.max(halfWidth + 8, Math.min(innerWidth - halfWidth - 8, anchorX));

    actionBar.classList.remove('is-below');
    actionBar.style.left = `${centerX}px`;
    if (anchorY >= barRect.height + 12) {
        actionBar.style.top = `${anchorY - 10}px`;
    } else {
        actionBar.classList.add('is-below');
        actionBar.style.top = `${Math.min(innerHeight - barRect.height - 8, anchorY + 10)}px`;
    }

    updateRadioDownloadCooldown(track);
}

function closeRadioDownloadActions(returnFocus = false) {
    const actionBar = dom['radio-download-actions'];
    if (!actionBar) return;

    actionBar.hidden = true;
    actionBar.classList.remove('is-open', 'is-below');
    actionBar.setAttribute('aria-hidden', 'true');
    appState.radioActionTrack = null;
    dom['radio-action-status']?.replaceChildren();

    if (returnFocus) dom['radio-cover-img']?.focus({ preventScroll: true });
}

function setRadioActionStatus(message) {
    if (dom['radio-action-status']) dom['radio-action-status'].textContent = message;
}

function getRadioShareTrackTitle(track) {
    return (track.cleanTitle || track.fullName)
        .replace(/\s+(?:glitchpunk|extended punk|alternative rock|alt rock|unplugged)\b.*$/i, '')
        .trim();
}

function onRadioTrackChange(track, previousTrack) {
    if (previousTrack && previousTrack.fullName !== track.fullName) {
        clearRadioDownloadCooldown();
        closeRadioDownloadActions();
        return;
    }

    updateRadioDownloadCooldown(track);
}

function getRadioDownloadCooldown(track) {
    const storedTimestamp = localStorage.getItem(RADIO_DOWNLOAD_TIMESTAMP_KEY);
    const downloadedTrack = localStorage.getItem(RADIO_DOWNLOAD_TRACK_KEY);
    if (storedTimestamp === null) return 0;
    const timestamp = Number(storedTimestamp);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        clearRadioDownloadCooldown();
        return 0;
    }

    if (downloadedTrack !== track.fullName) {
        clearRadioDownloadCooldown();
        return 0;
    }

    const remainingMs = RADIO_DOWNLOAD_COOLDOWN_MS - (Date.now() - timestamp);
    if (remainingMs <= 0) {
        clearRadioDownloadCooldown();
        return 0;
    }

    return Math.ceil(remainingMs / 1000);
}

function updateRadioDownloadCooldown(track) {
    const directButton = dom['radio-direct-download'];
    const countdown = dom['radio-direct-countdown'];
    if (!directButton || !countdown || !track) return;

    const remaining = getRadioDownloadCooldown(track);
    directButton.disabled = remaining > 0;
    countdown.textContent = remaining > 0
        ? (appState.currentLang === 'RU' ? `${remaining} с` : `${remaining}s`)
        : '';

    if (remaining > 0 && !appState.radioDownloadCooldownInterval) {
        appState.radioDownloadCooldownInterval = setInterval(() => {
            const currentTrack = appState.catalogueTracks[appState.currentRadioTrackIndex];
            if (currentTrack) updateRadioDownloadCooldown(currentTrack);
        }, 1000);
    } else if (remaining === 0 && appState.radioDownloadCooldownInterval) {
        clearInterval(appState.radioDownloadCooldownInterval);
        appState.radioDownloadCooldownInterval = null;
    }
}

function clearRadioDownloadCooldown() {
    localStorage.removeItem(RADIO_DOWNLOAD_TIMESTAMP_KEY);
    localStorage.removeItem(RADIO_DOWNLOAD_TRACK_KEY);
    if (appState.radioDownloadCooldownInterval) {
        clearInterval(appState.radioDownloadCooldownInterval);
        appState.radioDownloadCooldownInterval = null;
    }
    if (dom['radio-direct-download']) dom['radio-direct-download'].disabled = false;
    if (dom['radio-direct-countdown']) dom['radio-direct-countdown'].textContent = '';
}

function beginRadioDownload(track) {
    if (getRadioDownloadCooldown(track) > 0) return 'cooldown';

    const downloadBtn = dom['radio-download-btn'];
    if (!downloadBtn || !track.audioExt) return 'unavailable';

    downloadBtn.href = `audio/${track.fullName}.${track.audioExt}`;
    downloadBtn.download = `${track.fullName}.${track.audioExt}`;
    downloadBtn.click();
    localStorage.setItem(RADIO_DOWNLOAD_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(RADIO_DOWNLOAD_TRACK_KEY, track.fullName);
    updateRadioDownloadCooldown(track);
    return 'started';
}

async function shareRadioTrack(track) {
    const shareUrl = document.querySelector('link[rel="canonical"]')?.href || 'https://vira404.com/';
    const text = `🎸Listen NOCODE FM\n${getRadioShareTrackTitle(track)}`;

    if (typeof navigator.share === 'function') {
        try {
            await navigator.share({ title: 'Listen NOCODE FM', text, url: shareUrl });
            closeRadioDownloadActions();
            return;
        } catch (error) {
            if (error.name === 'AbortError') {
                closeRadioDownloadActions();
                return;
            }
            console.error('Native track sharing failed; falling back to copy link.', error);
        }
    }

    const shareText = `${text}\n${shareUrl}`;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareText);
        } else if (!copyTextToClipboard(shareText)) {
            throw new Error('Clipboard access is unavailable.');
        }
        setRadioActionStatus(appState.currentLang === 'RU'
            ? 'Ссылка скопирована.'
            : 'Share link copied.');
    } catch (error) {
        console.error('Could not copy the track share link.', error);
        setRadioActionStatus(appState.currentLang === 'RU'
            ? 'Не удалось скопировать ссылку.'
            : 'Could not copy the share link.');
    }
}

function copyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    textArea.remove();
    return copied;
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
async function loadRadioLyrics(track) {
    const trackName = typeof track === 'string' ? track : track?.fullName;
    if (!trackName) return;

    const catalogueTrack = typeof track === 'string'
        ? appState.catalogueTracks.find((item) => item.fullName === trackName)
        : track;
    const lyricsExt = catalogueTrack?.lyricsExt;

    appState.radioSrtData = [];
    if (dom['radio-lyrics-container']) {
        dom['radio-lyrics-container'].dataset.lastState = '';
    }

    if (lyricsExt === 'srt') {
        const srtText = await fetchTextResource(`lyrics/${trackName}.srt`);
        if (srtText !== null) {
            const parsed = parseSRT(srtText);
            if (parsed.length > 0) {
                appState.radioSrtData = parsed;
                return;
            }
        }
    } else if (lyricsExt === 'txt') {
        const txtText = await fetchTextResource(`lyrics/${trackName}.txt`);
        if (txtText !== null) {
            appState.radioSrtData = [{
                startSec: 0,
                endSec: 999999,
                text: txtText.trim().replace(/\n/g, '<br>'),
            }];
            return;
        }
    }

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
    const timerValueElem = timerElem?.querySelector('#countdown-value');
    if (!timerValueElem) return;

    if (appState.countdownInterval) {
        clearInterval(appState.countdownInterval);
        appState.countdownInterval = null;
    }

    function updateTimer() {
        const now = new Date();
        const target = new Date(dateString);

        if (Number.isNaN(target.getTime()) || target <= now) {
            timerValueElem.textContent = 'ONLINE NOW';
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
            timerValueElem.textContent = 'ONLINE NOW';
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

        timerValueElem.textContent = formatted;
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

/* ==========================================================
 * 9 - ÉCOUTEUR DOMCONTENTLOADED UNIQUE
 * ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (typeof updateRadioPassiveUI === 'function') {
            updateRadioPassiveUI();
        }
    }
});