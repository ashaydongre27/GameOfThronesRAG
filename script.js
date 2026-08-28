// ==========================================================================
// Lima RAG Assistant - Midnight Glass Brutalist UI Controller
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------
    // 1. WebGL Canvas Shader Background
    // -------------------------------------------------------------
    function initWebGLShader() {
        const canvas = document.getElementById('glcanvas');
        if (!canvas) return;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const vsSource = `
            attribute vec4 aVertexPosition;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = aVertexPosition;
                v_texCoord = aVertexPosition.xy * 0.5 + 0.5;
            }
        `;

        const fsSource = `
            precision highp float;
            varying vec2 v_texCoord;
            uniform float u_time;
            uniform vec2 u_resolution;

            void main() {
                vec2 uv = v_texCoord;
                vec3 color1 = vec3(0.04, 0.07, 0.15); // Deep Indigo
                vec3 color2 = vec3(0.12, 0.16, 0.23); // Slate
                vec3 color3 = vec3(0.06, 0.09, 0.20); // Mid-depth

                float noise1 = sin(uv.x * 3.0 + u_time * 0.2) * cos(uv.y * 2.0 + u_time * 0.3);
                float noise2 = cos(uv.y * 4.0 - u_time * 0.1) * sin(uv.x * 2.5 + u_time * 0.2);

                vec3 color = mix(color1, color2, noise1 * 0.5 + 0.5);
                color = mix(color, color3, noise2 * 0.5 + 0.5);

                float dist = length(uv - 0.5);
                color *= 1.0 - dist * 0.45;

                gl_FragColor = vec4(color, 1.0);
            }
        `;

        function createShader(gl, type, source) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        }

        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        if (!vertexShader || !fragmentShader) return;

        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) return;

        const programInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            },
            uniformLocations: {
                time: gl.getUniformLocation(shaderProgram, 'u_time'),
                resolution: gl.getUniformLocation(shaderProgram, 'u_resolution'),
            },
        };

        const positions = [
             1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
            -1.0, -1.0,
        ];

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        function render(now) {
            now *= 0.001;
            const displayWidth = canvas.clientWidth;
            const displayHeight = canvas.clientHeight;

            if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
                canvas.width = displayWidth;
                canvas.height = displayHeight;
                gl.viewport(0, 0, canvas.width, canvas.height);
            }

            gl.useProgram(programInfo.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

            gl.uniform1f(programInfo.uniformLocations.time, now);
            gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
    }

    initWebGLShader();


    // -------------------------------------------------------------
    // 2. Authentication Handlers (Login & Signup)
    // -------------------------------------------------------------
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const errorEl = document.getElementById('loginError');
            const loginBtn = loginForm.querySelector('.login-btn');

            errorEl.textContent = '';
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">refresh</span> Authenticating...';

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (data.success) {
                    sessionStorage.setItem('isAuthenticated', 'true');
                    sessionStorage.setItem('currentUser', JSON.stringify(data.user));
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    window.location.href = 'index.html';
                } else {
                    errorEl.textContent = data.error || 'Invalid username or password.';
                }
            } catch (error) {
                errorEl.textContent = 'Connection error. Is the server running?';
            } finally {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<span>Access System</span><span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
            }
        });
        return;
    }

    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const first_name = document.getElementById('first_name').value.trim();
            const last_name = document.getElementById('last_name').value.trim();
            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            const errorEl = document.getElementById('signupError');
            const signupBtn = signupForm.querySelector('.login-btn');

            errorEl.textContent = '';
            signupBtn.disabled = true;
            signupBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">refresh</span> Initializing Account...';

            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ first_name, last_name, email, username, password })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Account initialized successfully! Please log in.');
                    window.location.href = 'login.html';
                } else {
                    errorEl.textContent = data.error || 'Signup failed. Please try again.';
                }
            } catch (error) {
                errorEl.textContent = 'Connection error. Is the server running?';
            } finally {
                signupBtn.disabled = false;
                signupBtn.innerHTML = '<span>Create Authorized Account</span><span class="material-symbols-outlined text-[18px]">check_circle</span>';
            }
        });
        return;
    }


    // -------------------------------------------------------------
    // 3. User Session Verification
    // -------------------------------------------------------------
    const isAuth = sessionStorage.getItem('isAuthenticated') || localStorage.getItem('currentUser');
    if (!isAuth) {
        window.location.href = 'login.html';
        return;
    }

    let currentUser = null;
    try {
        currentUser = JSON.parse(sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser') || '{}');
    } catch (e) {
        currentUser = { username: 'User' };
    }

    const sidebarUsername = document.getElementById('sidebarUsername');
    const welcomeGreeting = document.getElementById('welcomeGreeting');

    if (sidebarUsername && currentUser.username) {
        sidebarUsername.textContent = currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser.username;
    }
    if (welcomeGreeting && currentUser.first_name) {
        welcomeGreeting.textContent = `Welcome back, ${currentUser.first_name}!`;
    }


    // -------------------------------------------------------------
    // 4. Available Knowledge Bases (RAG Contexts)
    // -------------------------------------------------------------
    const availableRAGs = [
        {
            id: "game_of_thrones",
            name: "Game of Thrones",
            desc: "Comprehensive lore, character arcs, and political machinations of Westeros.",
            icon: "castle",
            accentColor: "#f59e0b",
            page: "game-of-thrones.html"
        },
        {
            id: "spiderman",
            name: "Spider-Man",
            desc: "Multiversal index of Peter Parker variants, rogues gallery profiles, and comic continuity.",
            icon: "sports_martial_arts",
            accentColor: "#f43f5e",
            page: "spiderman.html"
        },
        {
            id: "apollo_11",
            name: "Apollo 11",
            desc: "Mission transcripts, technical schematics of the Saturn V, and historical lunar landing telemetry.",
            icon: "rocket_launch",
            accentColor: "#38bdf8",
            page: "apollo-11.html"
        }
    ];

    // Identify current page context
    const pageRagId = document.body.getAttribute('data-page-rag');
    const urlParams = new URLSearchParams(window.location.search);
    const activeRagId = pageRagId || urlParams.get('rag');
    let currentRAG = availableRAGs.find(r => r.id === activeRagId) || null;


    // -------------------------------------------------------------
    // 5. System Settings Management
    // -------------------------------------------------------------
    const themeProfiles = {
        midnight: { start: "#0f172a", end: "#1e293b", primary: "#adc6ff" },
        dark: { start: "#000000", end: "#121212", primary: "#60a5fa" },
        cosmic: { start: "#1e1b4b", end: "#312e81", primary: "#c084fc" },
        ocean: { start: "#0c4a6e", end: "#1e293b", primary: "#38bdf8" },
        sunset: { start: "#4c0519", end: "#1e293b", primary: "#fb7185" },
        forest: { start: "#064e3b", end: "#0f172a", primary: "#4edea3" },
        light: { start: "#e2e8f0", end: "#cbd5e1", primary: "#2563eb" }
    };

    let currentSettings = {
        themeProfile: "midnight",
        usermodel: "gemma4:31b-cloud",
        usertemperature: 0.5,
        umatch_count: 10,
        umatch_threshold: 0.4,
        sysprompt: "You are a helpful assistant. Use the following context to answer the user's question. If you don't know the answer based on the context, just say that you don't know."
    };

    const settingsModal = document.getElementById('settingsModal');
    const settingsBtn = document.getElementById('settingsBtn');
    const mobileSettingsBtn = document.getElementById('mobileSettingsBtn');
    const topbarSettingsBtn = document.getElementById('topbarSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const themeProfileSelect = document.getElementById('themeProfile');
    const usermodelInput = document.getElementById('usermodel');
    const usertemperatureInput = document.getElementById('usertemperature');
    const tempValSpan = document.getElementById('tempVal');
    const umatchCountInput = document.getElementById('umatch_count');
    const umatchThresholdInput = document.getElementById('umatch_threshold');
    const threshValSpan = document.getElementById('threshVal');
    const syspromptInput = document.getElementById('sysprompt');

    function loadSettings() {
        const saved = localStorage.getItem('ragSettings');
        if (saved) {
            try {
                currentSettings = { ...currentSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Settings load error:", e);
            }
        }
        applySettingsToUI();
        applyTheme();
    }

    function applySettingsToUI() {
        if (themeProfileSelect) themeProfileSelect.value = currentSettings.themeProfile || "midnight";
        if (usermodelInput) usermodelInput.value = currentSettings.usermodel || "gemma4:31b-cloud";
        if (usertemperatureInput) usertemperatureInput.value = currentSettings.usertemperature;
        if (tempValSpan) tempValSpan.textContent = currentSettings.usertemperature;
        if (umatchCountInput) umatchCountInput.value = currentSettings.umatch_count;
        if (umatchThresholdInput) umatchThresholdInput.value = currentSettings.umatch_threshold;
        if (threshValSpan) threshValSpan.textContent = currentSettings.umatch_threshold;
        if (syspromptInput) syspromptInput.value = currentSettings.sysprompt;
    }

    function applyTheme() {
        const profile = themeProfiles[currentSettings.themeProfile] || themeProfiles.midnight;
        document.documentElement.style.setProperty('--gradient-start', profile.start);
        document.documentElement.style.setProperty('--gradient-end', profile.end);
        document.documentElement.style.setProperty('--primary', profile.primary);
    }

    function toggleThemeQuick() {
        const profileKeys = Object.keys(themeProfiles);
        const currentIndex = profileKeys.indexOf(currentSettings.themeProfile);
        const nextProfile = profileKeys[(currentIndex + 1) % profileKeys.length];
        currentSettings.themeProfile = nextProfile;
        if (themeProfileSelect) themeProfileSelect.value = nextProfile;
        localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
        applyTheme();
    }

    // Modal Events
    const openSettings = () => settingsModal && settingsModal.classList.remove('hidden');
    const closeSettings = () => settingsModal && settingsModal.classList.add('hidden');

    if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
    if (mobileSettingsBtn) mobileSettingsBtn.addEventListener('click', openSettings);
    if (topbarSettingsBtn) topbarSettingsBtn.addEventListener('click', openSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettings);

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeSettings();
        });
    }

    if (usertemperatureInput && tempValSpan) {
        usertemperatureInput.addEventListener('input', (e) => tempValSpan.textContent = e.target.value);
    }
    if (umatchThresholdInput && threshValSpan) {
        umatchThresholdInput.addEventListener('input', (e) => threshValSpan.textContent = e.target.value);
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            currentSettings = {
                themeProfile: themeProfileSelect.value,
                usermodel: usermodelInput.value,
                usertemperature: parseFloat(usertemperatureInput.value),
                umatch_count: parseInt(umatchCountInput.value, 10),
                umatch_threshold: parseFloat(umatchThresholdInput.value),
                sysprompt: syspromptInput.value
            };
            localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
            applyTheme();
            closeSettings();
        });
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleThemeQuick);
    if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', toggleThemeQuick);

    // Mobile Sidebar Drawer Handlers
    const appSidebar = document.getElementById('appSidebar');
    const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function openMobileSidebar() {
        if (appSidebar) {
            appSidebar.classList.remove('-translate-x-full');
            appSidebar.classList.add('translate-x-0');
        }
        if (sidebarOverlay) sidebarOverlay.classList.remove('hidden');
    }

    function closeMobileSidebar() {
        if (appSidebar) {
            appSidebar.classList.remove('translate-x-0');
            appSidebar.classList.add('-translate-x-full');
        }
        if (sidebarOverlay) sidebarOverlay.classList.add('hidden');
    }

    if (mobileSidebarBtn) mobileSidebarBtn.addEventListener('click', openMobileSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

    // Logout Events
    const handleLogout = () => {
        sessionStorage.clear();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    };

    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', handleLogout);


    // -------------------------------------------------------------
    // 6. Chat History Management (Local & Supabase Sync)
    // -------------------------------------------------------------
    const chatArea = document.getElementById('chatArea');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatForm = document.getElementById('chat-form');
    const clearChatBtn = document.getElementById('clearChatBtn');

    function getLocalHistoryKey(ragId) {
        const uname = currentUser ? currentUser.username : 'guest';
        return `chat_history_${uname}_${ragId}`;
    }

    function getLocalHistory(ragId) {
        try {
            const data = localStorage.getItem(getLocalHistoryKey(ragId));
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveLocalHistory(ragId, historyArray) {
        try {
            localStorage.setItem(getLocalHistoryKey(ragId), JSON.stringify(historyArray));
        } catch (e) {
            console.error("Local storage save error:", e);
        }
    }

    async function loadChatHistory(ragId, ragName) {
        if (!chatArea) return;
        const msgContainer = chatArea.querySelector('.max-w-\\[900px\\]') || chatArea;

        // Keep the welcome header, clear previous messages
        const welcomeHeader = msgContainer.querySelector('.chat-bubble-enter');
        msgContainer.innerHTML = '';
        if (welcomeHeader) msgContainer.appendChild(welcomeHeader);

        // 1. Instant load from local storage
        const localHistory = getLocalHistory(ragId);
        if (localHistory && localHistory.length > 0) {
            localHistory.forEach(msg => {
                appendMessage(msg.message, msg.sender, msg.stats, msg.chunks, false);
            });
        }

        // 2. Query cloud database in background for multi-device sync
        if (currentUser && currentUser.username) {
            try {
                const res = await fetch(`/history?username=${encodeURIComponent(currentUser.username)}&rag_id=${encodeURIComponent(ragId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
                        if (JSON.stringify(data.messages) !== JSON.stringify(localHistory)) {
                            msgContainer.innerHTML = '';
                            if (welcomeHeader) msgContainer.appendChild(welcomeHeader);
                            data.messages.forEach(msg => {
                                appendMessage(msg.message, msg.sender, msg.stats, msg.chunks, false);
                            });
                            saveLocalHistory(ragId, data.messages);
                        }
                    }
                }
            } catch (err) {
                console.warn("History sync notice:", err);
            }
        }

        chatArea.scrollTop = chatArea.scrollHeight;
    }

    async function persistMessageTurn(userQuery, botAnswer, stats, chunks) {
        if (!currentRAG) return;
        const ragId = currentRAG.id;

        const history = getLocalHistory(ragId);
        const userMsg = { sender: 'user', message: userQuery, created_at: new Date().toISOString() };
        const botMsg = { sender: 'bot', message: botAnswer, stats: stats, chunks: chunks, created_at: new Date().toISOString() };
        history.push(userMsg);
        history.push(botMsg);
        saveLocalHistory(ragId, history);

        if (currentUser && currentUser.username) {
            try {
                await fetch('/history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        rag_id: ragId,
                        user_message: userQuery,
                        bot_message: botAnswer,
                        stats: stats,
                        chunks: chunks
                    })
                });
            } catch (err) {
                console.warn("Remote history save notice:", err);
            }
        }
    }

    async function handleClearChat() {
        if (!currentRAG) return;
        const confirmClear = confirm(`Clear conversation history for ${currentRAG.name}?`);
        if (!confirmClear) return;

        saveLocalHistory(currentRAG.id, []);

        if (currentUser && currentUser.username) {
            try {
                await fetch('/history', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: currentUser.username,
                        rag_id: currentRAG.id
                    })
                });
            } catch (err) {
                console.warn("Remote delete notice:", err);
            }
        }

        if (chatArea) {
            const msgContainer = chatArea.querySelector('.max-w-\\[900px\\]') || chatArea;
            const welcomeHeader = msgContainer.querySelector('.chat-bubble-enter');
            msgContainer.innerHTML = '';
            if (welcomeHeader) msgContainer.appendChild(welcomeHeader);
            appendMessage(`Conversation cleared for <strong>${currentRAG.name}</strong>. Ask a new question below!`, 'bot', null, null, false);
        }
    }

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', handleClearChat);
    }


    // -------------------------------------------------------------
    // 7. Message Rendering (Brutalist Glass Style)
    // -------------------------------------------------------------
    function appendMessage(text, sender, stats = null, chunks = null, autoScroll = true) {
        if (!chatArea) return;
        const msgContainer = chatArea.querySelector('.max-w-\\[900px\\]') || chatArea;
        const msgDiv = document.createElement('div');

        const hasStats = stats && typeof stats === 'object' && Object.keys(stats).length > 0;
        const hasChunks = Array.isArray(chunks) && chunks.length > 0;

        if (sender === 'user') {
            msgDiv.className = 'flex flex-col gap-1 max-w-[85%] self-end chat-bubble-enter-right';
            msgDiv.innerHTML = `
                <div class="flex items-center gap-1.5 text-on-surface-variant mb-0.5 justify-end">
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-primary">${currentUser ? (currentUser.first_name || currentUser.username) : 'User'}</span>
                    <span class="material-symbols-outlined text-[15px] text-primary">person</span>
                </div>
                <div class="bg-primary/10 border border-primary/30 backdrop-blur-xl p-4 rounded-none text-on-surface text-sm md:text-base leading-relaxed break-words">
                    ${text}
                </div>
            `;
        } else {
            msgDiv.className = 'flex flex-col gap-1 max-w-[85%] self-start chat-bubble-enter-left';

            let detailsHtml = '';
            if (hasStats || hasChunks) {
                let statsHtml = '';
                if (hasStats && stats.total_duration_sec !== undefined) {
                    statsHtml = `
                        <div class="grid grid-cols-3 gap-2 pb-2 mb-2 border-b border-glass-border/30 font-mono text-[11px] text-on-surface-variant">
                            <div>Latency: <strong class="text-primary">${stats.total_duration_sec}s</strong></div>
                            <div>Tokens: <strong class="text-primary">${stats.eval_count || 0}</strong></div>
                            <div>Speed: <strong class="text-primary">${stats.tokens_per_sec || 0} t/s</strong></div>
                        </div>
                    `;
                }

                let chunksHtml = '';
                if (hasChunks) {
                    chunksHtml = `
                        <div class="space-y-2 mt-2">
                            <div class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Matched Vector Chunks (${chunks.length}):</div>
                            ${chunks.map((c, i) => `
                                <div class="p-2 bg-surface-container/60 border border-glass-border/40 text-xs font-mono">
                                    <div class="flex justify-between text-primary font-bold mb-1">
                                        <span>Chunk ${i + 1} (ID: ${c.id})</span>
                                        <span>Sim: ${c.similarity}</span>
                                    </div>
                                    <div class="text-on-surface-variant font-sans text-xs line-clamp-3 leading-relaxed">${c.text}</div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }

                detailsHtml = `
                    <details class="mt-3 border-t border-glass-border/40 pt-2">
                        <summary class="flex items-center justify-between text-on-surface-variant hover:text-primary text-[11px] font-semibold uppercase tracking-wider select-none outline-none py-1">
                            <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">insights</span> Response Metrics & Chunks</span>
                            <span class="material-symbols-outlined text-[16px] summary-icon">expand_more</span>
                        </summary>
                        <div class="details-content">
                            <div class="details-inner pt-2">
                                ${statsHtml}
                                ${chunksHtml}
                            </div>
                        </div>
                    </details>
                `;
            }

            msgDiv.innerHTML = `
                <div class="flex items-center gap-1.5 text-on-surface-variant mb-0.5">
                    <span class="material-symbols-outlined text-[15px] text-primary">smart_toy</span>
                    <span class="text-[11px] font-semibold uppercase tracking-wider">Lima RAG</span>
                </div>
                <div class="bg-glass-panel border border-glass-border backdrop-blur-xl p-4 rounded-none text-on-surface text-sm md:text-base leading-relaxed break-words">
                    ${text}
                    ${detailsHtml}
                </div>
            `;
        }

        msgContainer.appendChild(msgDiv);
        if (autoScroll) {
            chatArea.scrollTop = chatArea.scrollHeight;
        }
        return msgDiv;
    }


    // -------------------------------------------------------------
    // 8. Sending Questions & API Interaction (/ask)
    // -------------------------------------------------------------
    async function sendMessage(e) {
        if (e) e.preventDefault();
        if (!userInput || !currentRAG) return;

        const query = userInput.value.trim();
        if (!query) return;

        appendMessage(query, 'user');
        userInput.value = '';
        userInput.style.height = '44px';

        const typingMsg = appendMessage('<span class="material-symbols-outlined animate-spin text-[16px] mr-1 align-middle">refresh</span> Retrieving context and formulating answer...', 'bot');

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    rag_id: currentRAG.id,
                    username: currentUser ? currentUser.username : "",
                    usermodel: currentSettings.usermodel,
                    usertemperature: currentSettings.usertemperature,
                    umatch_count: currentSettings.umatch_count,
                    umatch_threshold: currentSettings.umatch_threshold,
                    sysprompt: currentSettings.sysprompt
                })
            });

            const data = await response.json();
            typingMsg.remove();

            if (!response.ok || data.error) {
                const errorMsg = data.error || `Server error (${response.status})`;
                appendMessage(`⚠️ <strong>System Notice:</strong> ${errorMsg}`, 'bot');
            } else {
                appendMessage(data.answer, 'bot', data.stats, data.chunks);
                persistMessageTurn(query, data.answer, data.stats, data.chunks);
            }
        } catch (error) {
            typingMsg.remove();
            appendMessage(`⚠️ <strong>Connection Error:</strong> ${error.message}`, 'bot');
        }
    }

    if (chatForm) {
        chatForm.addEventListener('submit', sendMessage);
    }
    if (sendBtn && !chatForm) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (userInput) {
        // Auto-expand textarea
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 180) + 'px';
            if (this.value === '') {
                this.style.height = '44px';
            }
        });

        // Enter key to send (Shift+Enter for newline)
        userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }


    // -------------------------------------------------------------
    // 9. Initialization
    // -------------------------------------------------------------
    loadSettings();

    if (currentRAG) {
        loadChatHistory(currentRAG.id, currentRAG.name);
    }
});