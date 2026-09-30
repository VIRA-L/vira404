let parsedConfig = null;
let currentLang = localStorage.getItem('userLang') || 'EN'; // <--- MODIFIÉ ICI
let catalogueTracks = [];
let totalRadioDuration = 0;
let currentRadioTrackIndex = -1;
let radioSrtData = [];
let radioInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    async function initApp() {
        let configText = "";
        let catalogueText = "";

        try {
            const resConfig = await fetch('Config404.txt');
            if (!resConfig.ok) throw new Error();
            configText = await resConfig.text();
        } catch (e) {
            configText = await askUserForFile("Sélectionne ton fichier : Config404.txt");
        }

        if (configText) processConfig(configText);

        try {
            const resCat = await fetch('Catalogue Vira L.txt');
            if (!resCat.ok) throw new Error();
            catalogueText = await resCat.text();
        } catch (e) {
            catalogueText = await askUserForFile("Sélectionne ton fichier : Catalogue Vira L.txt");
        }

        if (catalogueText) processCatalogue(catalogueText);
    }

    // Appel indispensable de l'initialisation pour que tout se lance
    initApp();
});

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

// --- CONFIG & PAVÉ 3 (RESTAURÉ À L'IDENTIQUE) ---
function processConfig(text) {
    parsedConfig = parseConfigTxt(text);

    const btnEn = document.getElementById('btn-lang-en');
    const btnRu = document.getElementById('btn-lang-ru');
    if (btnEn) btnEn.onclick = () => switchLanguage('EN');
    if (btnRu) btnRu.onclick = () => switchLanguage('RU');
    if (btnEn) btnEn.classList.toggle('active', currentLang === 'EN');
    if (btnRu) btnRu.classList.toggle('active', currentLang === 'RU');

    // 1. PAVÉ 1 : Rendu Landing
    renderLanding();

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
        audio.play().catch(() => {
            // Le navigateur bloque l'autoplay non sollicité, c'est normal.
            // Le player sera prêt et se lancera au premier clic de l'utilisateur.
            console.log("Autoplay en attente d'interaction utilisateur.");
        });

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
            const savedLoop = localStorage.getItem('audioLoop') === 'true';
            audio.loop = savedLoop;
            loopBtn.classList.toggle('active', audio.loop);

            loopBtn.onclick = () => {
                audio.loop = !audio.loop;
                loopBtn.classList.toggle('active', audio.loop);
                localStorage.setItem('audioLoop', audio.loop);
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
            const savedVolume = localStorage.getItem('audioVolume');
            audio.volume = savedVolume ? parseFloat(savedVolume) : (parseFloat(volumeBar.value) || 0.8);
            volumeBar.value = audio.volume;
            volumeBar.oninput = () => {
                audio.volume = parseFloat(volumeBar.value);
                localStorage.setItem('audioVolume', audio.volume);
            };
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

function switchLanguage(lang) {
    if (currentLang === lang) return;
    currentLang = lang;
    localStorage.setItem('userLang', lang);

    const btnEn = document.getElementById('btn-lang-en');
    const btnRu = document.getElementById('btn-lang-ru');
    if (btnEn) btnEn.classList.toggle('active', lang === 'EN');
    if (btnRu) btnRu.classList.toggle('active', lang === 'RU');

    renderLanding();
    if (typeof updateRadioPassiveUI === 'function') updateRadioPassiveUI();
}

function renderLanding() {
    if (!parsedConfig) return;

    const baseData = parsedConfig.LANDING || {};
    const langData = parsedConfig[`LANDING_${currentLang}`] || {};
    const configLanding = { ...baseData, ...langData };

    document.getElementById('landing-title').innerText = configLanding.title || "VIRA404";
    let subtitleText = configLanding.subtitle || "";
    subtitleText = subtitleText.replace(
        "NoCodeGirl", 
        `<span style="color: var(--accent-fuchsia);">No</span><span style="color: var(--accent-teal);">Code</span><span style="color: var(--accent-fuchsia);">Girl</span>`
    );

    document.getElementById('landing-subtitle').innerHTML = subtitleText;
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

                const firstChar = Array.from(textLink)[0] || '🔗';
                const iconContainer = document.createElement('span');
                iconContainer.className = 'social-icon';

                const img = document.createElement('img');
                img.src = `assets/link${i}.svg`;
                img.alt = textLink;

                img.onerror = function() {
                    this.onerror = null;
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

// --- PAVÉ 2 (RADIO - CORRIGÉ) ---
function processCatalogue(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    let tempTracks = [];
    
    for (let line of lines) {
        const parsed = parseCatalogueLine(line);
        if (parsed) {
            tempTracks.push(parsed);
        }
    }

    // Calcul dynamique des endSec (le endSec d'une piste est le startSec de la suivante)
    catalogueTracks = tempTracks.map((track, index) => {
        let endSec;
        if (index < tempTracks.length - 1) {
            endSec = tempTracks[index + 1].startSec;
        } else {
            endSec = track.startSec + track.durationSec;
        }
        return { ...track, endSec };
    });

    if (catalogueTracks.length === 0) return;

    totalRadioDuration = catalogueTracks[catalogueTracks.length - 1].endSec;

    initRadioControls();
    updateRadioPassiveUI();

    if (radioInterval) clearInterval(radioInterval);
    radioInterval = setInterval(updateRadioPassiveUI, 1000);
}

function parseTimeToSec(str) {
    if (!str) return 0;
    const parts = str.split(':').map(Number);
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return 0;
}

function parseCatalogueLine(line) {
    // Découpage selon ton format réel : "00:00:00 / Titre / Album / Année / Durée"
    const parts = line.split(' / ').map(p => p.trim());
    if (parts.length < 2) return null;

    const startStr = parts[0];
    const rightSide = parts[1];
    const subParts = rightSide.split('/').map(p => p.trim());
    
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
        isSingle
    };
}

function getLiveRadioState() {
    if (!catalogueTracks.length || !totalRadioDuration) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const loopSec = nowSec % totalRadioDuration;

    let index = catalogueTracks.findIndex(t => loopSec >= t.startSec && loopSec < t.endSec);
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

    if (trackIndex !== currentRadioTrackIndex) {
        currentRadioTrackIndex = trackIndex;

        const titleElem = document.getElementById('radio-track-title');
        if (titleElem) titleElem.innerText = track.cleanTitle;

        const infoElem = document.getElementById('radio-track-info');
        if (infoElem) {
            const trackPrefix = currentLang === 'RU' ? 'трек' : 'Track';
            if (track.trackNum && !track.isSingle) {
                infoElem.innerText = `${trackPrefix} ${track.trackNum}, ${track.year}`;
            } else {
                infoElem.innerText = track.year;
            }
        }

        const albumElem = document.getElementById('radio-album-name');
        if (albumElem) {
            albumElem.innerText = track.isSingle ? 'Single' : track.album;
        }

        const downloadBtn = document.getElementById('radio-download-btn');
        if (downloadBtn) {
            downloadBtn.href = `audio/${track.fullName}.m4a`;
        }

        const coverImg = document.getElementById('radio-cover-img');
        if (coverImg) {
            coverImg.onerror = function() {
                this.onerror = null;
                this.src = 'covers/cover_default.webp';
            };
            coverImg.src = `covers/${track.fullName}.webp`;
        }

        const albumImg = document.getElementById('radio-album-img');
        if (albumImg) {
            albumImg.onerror = function() {
                this.onerror = null;
                this.src = 'assets/artworks/default.webp';
            };
            if (track.isSingle) {
                albumImg.src = 'assets/artworks/default.webp';
            } else {
                albumImg.src = `assets/artworks/${track.album}.webp`;
            }
        }

        loadRadioLyrics(track.fullName);
    }

    const radioAudio = document.getElementById('radio-audio');
    const activeTime = (radioAudio && !radioAudio.paused) ? radioAudio.currentTime : offset;
    syncRadioLyrics(activeTime);
}

function initRadioControls() {
    let audio = document.getElementById('radio-audio');
    if (!audio) {
        audio = document.createElement('audio');
        audio.id = 'radio-audio';
        audio.preload = 'none';
        document.body.appendChild(audio);
    }

    const playBtn = document.getElementById('radio-toggle-btn') || 
                    document.getElementById('radio-play-btn') || 
                    document.querySelector('#pave-radio .play-btn') ||
                    document.querySelector('#pave-radio button');

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
}

function startRadioAudio() {
    const audio = document.getElementById('radio-audio');
    const playBtn = document.getElementById('radio-toggle-btn') || 
                    document.getElementById('radio-play-btn') || 
                    document.querySelector('#pave-radio .play-btn') ||
                    document.querySelector('#pave-radio button');
    
    const badgeOnAir = document.getElementById('radio-badge') || document.querySelector('.live-badge');
    const state = getLiveRadioState();

    if (!audio || !state) return;

    const featAudio = document.getElementById('featured-audio');
    if (featAudio && !featAudio.paused) {
        featAudio.pause();
    }

    audio.src = `audio/${state.track.fullName}.m4a`;
    audio.currentTime = state.offset;

    audio.onerror = function() {
        if (this.src.endsWith('.m4a')) {
            this.src = `audio/${state.track.fullName}.mp3`;
            this.play().catch(() => {});
        }
    };

    audio.play().then(() => {
        if (playBtn) playBtn.classList.add('playing');
        if (badgeOnAir) badgeOnAir.classList.add('active');
    }).catch(err => {
        console.log("Lecture audio radio bloquée ou erreur :", err);
    });
}

function stopRadioAudio() {
    const audio = document.getElementById('radio-audio');
    const playBtn = document.getElementById('radio-toggle-btn') || 
                    document.getElementById('radio-play-btn') || 
                    document.querySelector('#pave-radio .play-btn') ||
                    document.querySelector('#pave-radio button');
    const badgeOnAir = document.getElementById('radio-badge') || document.querySelector('.live-badge');

    if (audio) audio.pause();
    if (playBtn) playBtn.classList.remove('playing');
    if (badgeOnAir) badgeOnAir.classList.remove('active');
}

function loadRadioLyrics(trackName) {
    const srtPath = `lyrics/${trackName}.srt`;
    fetch(srtPath)
        .then(res => {
            if (!res.ok) throw new Error("Fichier SRT introuvable");
            return res.text();
        })
        .then(text => {
            radioSrtData = parseSRT(text);
        })
        .catch(() => {
            radioSrtData = [];
            const container = document.getElementById('radio-lyrics-container');
            if (container) container.innerHTML = '<span class="no-lyrics">---</span>';
        });
}

function parseSRT(data) {
    const subtitles = [];
    const blocks = data.replace(/\r/g, '').split('\n\n');

    for (let block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 3) {
            const timeLine = lines[1];
            const textLines = lines.slice(2).join('<br>');
            const times = timeLine.split(' --> ');

            if (times.length === 2) {
                const startSec = parseSrtTime(times[0]);
                const endSec = parseSrtTime(times[1]);
                subtitles.push({ startSec, endSec, text: textLines });
            }
        }
    }
    return subtitles;
}

function parseSrtTime(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length < 3) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secParts = parts[2].split(',');
    const seconds = parseInt(secParts[0], 10);
    const milliseconds = parseInt(secParts[1] || 0, 10);
    return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000);
}

function syncRadioLyrics(currentTime) {
    const container = document.getElementById('radio-lyrics-container');
    if (!container) return;

    if (!radioSrtData.length) {
        container.innerHTML = '<span class="no-lyrics">...</span>';
        return;
    }

    const currentSub = radioSrtData.find(sub => currentTime >= sub.startSec && currentTime <= sub.endSec);

    if (currentSub) {
        if (container.innerHTML !== currentSub.text) {
            container.innerHTML = currentSub.text;
        }
    } else {
        container.innerHTML = '<span class="no-lyrics">...</span>';
    }
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

// Défilement horizontal à la molette de souris sur PC
document.addEventListener("DOMContentLoaded", () => {
    const gridContainer = document.querySelector('.grid-container');
    if (gridContainer) {
        gridContainer.addEventListener('wheel', (evt) => {
            if (gridContainer.scrollWidth > gridContainer.clientWidth) {
                evt.preventDefault();
                gridContainer.scrollLeft += evt.deltaY;
            }
        }, { passive: false });
    }
});