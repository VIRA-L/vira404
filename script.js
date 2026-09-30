let parsedConfig = null;
let currentLang = 'EN';

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    let configText = "";
    let catalogueText = "";

    // Tentative de chargement normal (fonctionnera direct sur GitHub Pages)
    try {
        const resConfig = await fetch('Config404.txt');
        configText = await resConfig.text();
    } catch (e) {
        // Si Opera bloque en local, on demande les fichiers à l'utilisateur
        configText = await askUserForFile("Sélectionne ton fichier : Config404.txt");
    }

    try {
        const resCat = await fetch('Catalogue Vira L.txt');
        catalogueText = await resCat.text();
    } catch (e) {
        catalogueText = await askUserForFile("Sélectionne ton fichier : Catalogue Vira L.txt");
    }

    // Traitement des données récupérées
    if (configText) processConfig(configText);
    if (catalogueText) processCatalogue(catalogueText);
}

// Petite boîte de secours pour choisir le fichier si le navigateur bloque
function askUserForFile(message) {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        div.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#222; color:#fff; padding:20px; border:2px solid #ff3333; z-index:9999; text-align:center; font-family:sans-serif;";
        div.innerHTML = `<p style="margin-bottom:10px;">${message}</p><input type="file" id="file-picker">`;
        document.body.appendChild(div);

        document.getElementById('file-picker').addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    div.remove();
                    resolve(e.target.result);
                };
                reader.readAsText(file);
            }
        });
    });
}

// --- TRAITEMENT CONFIG ---
function processConfig(text) {
    parsedConfig = parseConfigTxt(text);

    // Écouteurs sur les boutons de langue
    const btnEn = document.getElementById('btn-lang-en');
    const btnRu = document.getElementById('btn-lang-ru');

    if (btnEn) btnEn.onclick = () => switchLanguage('EN');
    if (btnRu) btnRu.onclick = () => switchLanguage('RU');

    // 1. PAVÉ 1 : Rendu Landing
    renderLanding();

    // 2. PAVÉ 3 : Featured Drop
    const featTitle = document.getElementById('featured-track-title');
    if (featTitle) featTitle.innerText = parsedConfig.FEATURED?.track || "";

    const featCaption = document.getElementById('featured-caption');
    if (featCaption) featCaption.innerText = parsedConfig.FEATURED?.caption || "";

    const featuredArtwork = parsedConfig.FEATURED?.artwork;
    if (featuredArtwork) {
        const featBox = document.getElementById('featured-artwork-container');
        if (featBox) {
            featBox.style.backgroundImage = `url('${featuredArtwork}')`;
            featBox.style.backgroundSize = 'cover';
            featBox.style.backgroundPosition = 'center';
        }
    }
// Injection de la date Pavé 3
const featDateElem = document.getElementById('featured-date');
if (featDateElem) {
    featDateElem.innerText = parsedConfig.FEATURED?.date ? `[ ${parsedConfig.FEATURED.date} ]` : "";
}
    // Initialisation du lecteur Pavé 3
    const featuredTrack = parsedConfig.FEATURED?.track;
    if (featuredTrack) {
        let audio = document.getElementById('featured-audio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.id = 'featured-audio';
            audio.preload = 'metadata';
            document.body.appendChild(audio);
        }
        audio.src = `audio/${featuredTrack}.m4a`;

        const playBtn = document.getElementById('feat-play');
        const rewindBtn = document.getElementById('feat-rewind');
        const forwardBtn = document.getElementById('feat-forward');
        const loopBtn = document.getElementById('feat-loop');
        const progressBar = document.getElementById('feat-seek');
        const volumeBar = document.getElementById('feat-volume');

        if (playBtn) {
            playBtn.onclick = () => {
                if (audio.paused) {
                    document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
                    audio.play();
                } else {
                    audio.pause();
                }
            };
        }

        if (rewindBtn) rewindBtn.onclick = () => audio.currentTime = Math.max(0, audio.currentTime - 10);
        if (forwardBtn) forwardBtn.onclick = () => audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10);

        if (loopBtn) {
            loopBtn.onclick = () => {
                audio.loop = !audio.loop;
                loopBtn.classList.toggle('active', audio.loop);
            };
        }

        if (progressBar) {
            audio.ontimeupdate = () => {
                if (audio.duration) progressBar.value = (audio.currentTime / audio.duration) * 100;
            };
            progressBar.oninput = () => {
                if (audio.duration) audio.currentTime = (progressBar.value / 100) * audio.duration;
            };
        }

        if (volumeBar) {
            audio.volume = parseFloat(volumeBar.value) || 0.8;
            volumeBar.oninput = () => audio.volume = parseFloat(volumeBar.value);
        }
    }

    // 3. PAVÉ 4 : Working (Rendu garanti)
    const workTitle = document.getElementById('working-title');
    if (workTitle) workTitle.innerText = parsedConfig.WORKING?.title || "";

    const workCap1 = document.getElementById('working-caption1');
    if (workCap1) workCap1.innerText = parsedConfig.WORKING?.caption1 || "";

    const workCap2 = document.getElementById('working-caption2');
    if (workCap2) workCap2.innerText = parsedConfig.WORKING?.caption2 || "";

    const workingArtwork = parsedConfig.WORKING?.artwork;
    if (workingArtwork) {
        const workBox = document.getElementById('working-artwork-container');
        if (workBox) {
            workBox.style.backgroundImage = `url('${workingArtwork}')`;
            workBox.style.backgroundSize = 'cover';
            workBox.style.backgroundPosition = 'center';
        }
    }

    if (parsedConfig.WORKING?.date) {
        initCountdown(parsedConfig.WORKING.date);
    }
}

// --- GESTION DE LA LANGUE ET DU PAVÉ 1 ---
function switchLanguage(lang) {
    if (currentLang === lang) return;
    currentLang = lang;

    const btnEn = document.getElementById('btn-lang-en');
    const btnRu = document.getElementById('btn-lang-ru');
    if (btnEn) btnEn.classList.toggle('active', lang === 'EN');
    if (btnRu) btnRu.classList.toggle('active', lang === 'RU');

    renderLanding();
}

function renderLanding() {
    if (!parsedConfig) return;

    const baseData = parsedConfig.LANDING || {};
    const langData = parsedConfig[`LANDING_${currentLang}`] || {};
    const configLanding = { ...baseData, ...langData };

    document.getElementById('landing-title').innerText = configLanding.title || "VIRA404";
    document.getElementById('landing-subtitle').innerText = configLanding.subtitle || "";
    document.getElementById('landing-caption1').innerText = configLanding.caption1 || "";
    document.getElementById('landing-caption2').innerText = configLanding.caption2 || "";
    document.getElementById('landing-caption3').innerText = configLanding.caption3 || "";

    const linksBox = document.getElementById('landing-links');
    if (linksBox) {
        linksBox.innerHTML = '';
        linksBox.className = 'pave-footer social-grid';

        for (let i = 1; i <= 4; i++) {
            const textLink = configLanding[`link${i}text`];
            const pageLink = configLanding[`link${i}page`];
            
            if (textLink && pageLink) {
                const a = document.createElement('a');
                a.href = pageLink;
                a.className = 'social-btn';
                a.target = "_blank";

                // Récupération du 1er caractère ou émoji
                const firstChar = Array.from(textLink)[0] || '🔗';

                const iconContainer = document.createElement('span');
                iconContainer.className = 'social-icon';

                const img = document.createElement('img');
                img.src = `assets/link${i}.svg`;
                img.alt = textLink;

                // Si l'image SVG n'existe pas dans assets/, fallback sur le 1er caractère
                img.onerror = () => {
                    iconContainer.innerText = firstChar;
                };

                iconContainer.appendChild(img);

                const labelSpan = document.createElement('span');
                labelSpan.className = 'social-label';
                labelSpan.innerText = textLink;

                a.appendChild(iconContainer);
                a.appendChild(labelSpan);
                linksBox.appendChild(a);
            }
        }
    }

    const landingArtwork = configLanding.artwork;
    if (landingArtwork) {
        const paveLanding = document.getElementById('pave-landing');
        if (paveLanding) {
            paveLanding.style.backgroundImage = `url('${landingArtwork}')`;
            paveLanding.style.backgroundSize = 'cover';
            paveLanding.style.backgroundPosition = 'center';
        }
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
        } else if (currentSection && line.includes('=')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            let value = parts.slice(1).join('=').trim();
            value = value.replace(/\s*::.*$/, '').replace(/^["'](.*)["']$/, '$1');
            value = value.replace(/\\n/g, '\n');
            data[currentSection][key] = value;
        }
    }
    return data;
}

// --- TRAITEMENT CATALOGUE ---
function processCatalogue(text) {
    const tracks = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    console.log(`Catalogue chargé : ${tracks.length} morceaux.`);
}

// --- COMPTE À REBOURS DYNAMIQUE ---
function initCountdown(dateString) {
    const timerElem = document.getElementById('countdown-timer');
    if (!timerElem) return;

    function updateTimer() {
        const now = new Date();
        const target = new Date(dateString);

        if (isNaN(target.getTime()) || target <= now) {
            timerElem.innerText = "ONLINE NOW";
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
        if (months < 0) { months += 12; years--; }

        const units = [
            { val: years, suffix: 'y' },
            { val: months, suffix: 'm' },
            { val: days, suffix: 'd' },
            { val: hours, suffix: 'h' },
            { val: minutes, suffix: 'm' },
            { val: seconds, suffix: 's' }
        ];

        const firstNonZeroIndex = units.findIndex(u => u.val > 0);

        if (firstNonZeroIndex === -1) {
            timerElem.innerText = "ONLINE NOW";
            return;
        }

        const activeUnits = units.slice(firstNonZeroIndex);

        const formatted = activeUnits
            .map((u, idx) => {
                const valStr = (idx > 0 && u.val < 10) ? `0${u.val}` : `${u.val}`;
                return `${valStr}${u.suffix}`;
            })
            .join(' ');

        timerElem.innerText = formatted;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}