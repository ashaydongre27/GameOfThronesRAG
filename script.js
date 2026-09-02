// ==========================================================================
// Lima Controller - Dark/Light Switcher & Realtime Appearance Profiles
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {

    // -------------------------------------------------------------
    // 1. WebGL Canvas Shader Background with Dynamic Colors
    // -------------------------------------------------------------
    let glProgramInfo = null;
    let glContext = null;

    const themeColors = {
        midnight: {
            c1: [0.04, 0.07, 0.15],
            c2: [0.12, 0.16, 0.23],
            c3: [0.06, 0.09, 0.20],
            start: "#0f172a",
            end: "#1e293b",
            surface: "#0b1326",
            surfaceContainer: "#171f33",
            onSurface: "#dae2fd",
            primary: "#adc6ff"
        },
        dark: {
            c1: [0.0, 0.0, 0.0],
            c2: [0.07, 0.07, 0.07],
            c3: [0.03, 0.03, 0.03],
            start: "#000000",
            end: "#121212",
            surface: "#000000",
            surfaceContainer: "#141414",
            onSurface: "#ffffff",
            primary: "#60a5fa"
        },
        cosmic: {
            c1: [0.10, 0.05, 0.22],
            c2: [0.19, 0.11, 0.35],
            c3: [0.06, 0.03, 0.15],
            start: "#1e1b4b",
            end: "#312e81",
            surface: "#0f0c29",
            surfaceContainer: "#1f1747",
            onSurface: "#f3e8ff",
            primary: "#c084fc"
        },
        ocean: {
            c1: [0.02, 0.12, 0.20],
            c2: [0.05, 0.22, 0.35],
            c3: [0.01, 0.08, 0.14],
            start: "#0c4a6e",
            end: "#075985",
            surface: "#032030",
            surfaceContainer: "#08334c",
            onSurface: "#e0f2fe",
            primary: "#38bdf8"
        },
        sunset: {
            c1: [0.20, 0.02, 0.08],
            c2: [0.35, 0.05, 0.15],
            c3: [0.12, 0.01, 0.05],
            start: "#4c0519",
            end: "#881337",
            surface: "#260510",
            surfaceContainer: "#3d0a1b",
            onSurface: "#ffe4e6",
            primary: "#fb7185"
        },
        forest: {
            c1: [0.01, 0.15, 0.10],
            c2: [0.03, 0.25, 0.18],
            c3: [0.01, 0.09, 0.06],
            start: "#064e3b",
            end: "#065f46",
            surface: "#022c22",
            surfaceContainer: "#064e3b",
            onSurface: "#d1fae5",
            primary: "#34d399"
        },
        light: {
            c1: [0.92, 0.94, 0.97],
            c2: [0.85, 0.89, 0.94],
            c3: [0.96, 0.97, 0.99],
            start: "#f8fafc",
            end: "#e2e8f0",
            surface: "#f8fafc",
            surfaceContainer: "#ffffff",
            onSurface: "#0f172a",
            primary: "#2563eb"
        }
    };

    let activeColors = themeColors.midnight;

    function initWebGLShader() {
        const canvas = document.getElementById('glcanvas');
        if (!canvas) return;
        const gl = canvas.getContext('webgl');
        if (!gl) return;
        glContext = gl;

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
            uniform vec3 u_color1;
            uniform vec3 u_color2;
            uniform vec3 u_color3;

            void main() {
                vec2 uv = v_texCoord;
                float noise1 = sin(uv.x * 3.0 + u_time * 0.2) * cos(uv.y * 2.0 + u_time * 0.3);
                float noise2 = cos(uv.y * 4.0 - u_time * 0.1) * sin(uv.x * 2.5 + u_time * 0.2);

                vec3 color = mix(u_color1, u_color2, noise1 * 0.5 + 0.5);
                color = mix(color, u_color3, noise2 * 0.5 + 0.5);

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

        glProgramInfo = {
            program: shaderProgram,
            attribLocations: {
                vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            },
            uniformLocations: {
                time: gl.getUniformLocation(shaderProgram, 'u_time'),
                resolution: gl.getUniformLocation(shaderProgram, 'u_resolution'),
                color1: gl.getUniformLocation(shaderProgram, 'u_color1'),
                color2: gl.getUniformLocation(shaderProgram, 'u_color2'),
                color3: gl.getUniformLocation(shaderProgram, 'u_color3'),
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

            gl.useProgram(glProgramInfo.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.vertexAttribPointer(glProgramInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(glProgramInfo.attribLocations.vertexPosition);

            gl.uniform1f(glProgramInfo.uniformLocations.time, now);
            gl.uniform2f(glProgramInfo.uniformLocations.resolution, canvas.width, canvas.height);

            gl.uniform3fv(glProgramInfo.uniformLocations.color1, activeColors.c1);
            gl.uniform3fv(glProgramInfo.uniformLocations.color2, activeColors.c2);
            gl.uniform3fv(glProgramInfo.uniformLocations.color3, activeColors.c3);

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
    // 4. Available Knowledge Bases
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

    const pageRagId = document.body.getAttribute('data-page-rag');
    const urlParams = new URLSearchParams(window.location.search);
    const activeRagId = pageRagId || urlParams.get('rag');
    let currentRAG = availableRAGs.find(r => r.id === activeRagId) || null;


    // -------------------------------------------------------------
    // 5. System Settings, Dark/Light Mode & Appearance Profiles
    // -------------------------------------------------------------
    let currentSettings = {
        themeProfile: "midnight",
        lastDarkThemeProfile: "midnight",
        colorMode: "dark",
        usermodel: "gpt-oss:20b-cloud",
        usertemperature: 0.5,
        umatch_count: 8,
        umatch_threshold: 0.35,
        sysprompt: "You are a helpful assistant. Use the provided context to answer the user's question accurately."
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

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const mobileThemeToggle = document.getElementById('mobileThemeToggle');
    const themeToggleIcon = document.getElementById('themeToggleIcon');
    const themeToggleText = document.getElementById('themeToggleText');

    function loadSettings() {
        const saved = localStorage.getItem('ragSettings');
        if (saved) {
            try {
                currentSettings = { ...currentSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Settings load error:", e);
            }
        }
        if (currentSettings.themeProfile && currentSettings.themeProfile !== "light") {
            currentSettings.lastDarkThemeProfile = currentSettings.themeProfile;
        }
        applySettingsToUI();
        applyAppearance();
    }

    function applySettingsToUI() {
        if (themeProfileSelect) themeProfileSelect.value = currentSettings.themeProfile || "midnight";
        if (usermodelInput) usermodelInput.value = currentSettings.usermodel || "gpt-oss:20b-cloud";
        if (usertemperatureInput) usertemperatureInput.value = currentSettings.usertemperature;
        if (tempValSpan) tempValSpan.textContent = currentSettings.usertemperature;
        if (umatchCountInput) umatchCountInput.value = currentSettings.umatch_count;
        if (umatchThresholdInput) umatchThresholdInput.value = currentSettings.umatch_threshold;
        if (threshValSpan) threshValSpan.textContent = currentSettings.umatch_threshold;
        if (syspromptInput) syspromptInput.value = currentSettings.sysprompt;
    }

    function applyAppearance() {
        const isLight = currentSettings.colorMode === "light" || currentSettings.themeProfile === "light";
        const root = document.documentElement;
        const body = document.body;

        // 1. Toggle light/dark class on html
        if (isLight) {
            root.classList.remove('dark');
            root.classList.add('light');
        } else {
            root.classList.remove('light');
            root.classList.add('dark');
        }

        // 2. Apply theme profile class on body
        const profile = currentSettings.themeProfile || "midnight";
        body.className = body.className.replace(/theme-\w+/g, '').trim();
        body.classList.add(`theme-${profile}`);

        // 3. Update CSS Variables in real-time
        const colors = themeColors[profile] || themeColors.midnight;
        activeColors = colors;

        root.style.setProperty('--gradient-start', colors.start);
        root.style.setProperty('--gradient-end', colors.end);
        root.style.setProperty('--surface', colors.surface);
        root.style.setProperty('--surface-container', colors.surfaceContainer);
        root.style.setProperty('--on-surface', colors.onSurface);
        root.style.setProperty('--on-surface-variant', isLight ? '#334155' : (colors.onSurfaceVariant || '#c2c6d6'));
        root.style.setProperty('--primary', colors.primary);
        root.style.setProperty('--sidebar-bg', isLight ? '#ffffff' : (colors.sidebarBg || colors.surface));
        root.style.setProperty('--glass-bg', isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.04)');
        root.style.setProperty('--glass-border', isLight ? 'rgba(15, 23, 42, 0.15)' : 'rgba(255, 255, 255, 0.15)');

        // 4. Update Theme Switcher Icon & Text
        const isCurrentlyLight = root.classList.contains('light');
        if (themeToggleIcon) themeToggleIcon.textContent = isCurrentlyLight ? 'light_mode' : 'dark_mode';
        if (themeToggleText) themeToggleText.textContent = isCurrentlyLight ? 'Light Mode' : 'Dark Mode';
    }

    // Direct Dark / Light Mode Switcher with memory of last dark profile
    function toggleDarkLightMode() {
        const isLight = document.documentElement.classList.contains('light');
        if (isLight) {
            currentSettings.colorMode = "dark";
            currentSettings.themeProfile = currentSettings.lastDarkThemeProfile || "midnight";
        } else {
            currentSettings.colorMode = "light";
            if (currentSettings.themeProfile && currentSettings.themeProfile !== "light") {
                currentSettings.lastDarkThemeProfile = currentSettings.themeProfile;
            }
            currentSettings.themeProfile = "light";
        }
        if (themeProfileSelect) themeProfileSelect.value = currentSettings.themeProfile;
        localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
        applyAppearance();
    }

    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleDarkLightMode);
    if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', toggleDarkLightMode);

    // Live preview when changing Appearance Profile in settings modal
    if (themeProfileSelect) {
        themeProfileSelect.addEventListener('change', (e) => {
            const selectedProfile = e.target.value;
            currentSettings.themeProfile = selectedProfile;
            if (selectedProfile === "light") {
                currentSettings.colorMode = "light";
            } else {
                currentSettings.colorMode = "dark";
                currentSettings.lastDarkThemeProfile = selectedProfile;
            }
            localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
            applyAppearance();
        });
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
            const selectedProfile = themeProfileSelect.value;
            const isLight = selectedProfile === "light";
            currentSettings.themeProfile = selectedProfile;
            currentSettings.colorMode = isLight ? "light" : "dark";
            if (!isLight) {
                currentSettings.lastDarkThemeProfile = selectedProfile;
            }
            currentSettings.usermodel = usermodelInput.value;
            currentSettings.usertemperature = parseFloat(usertemperatureInput.value);
            currentSettings.umatch_count = parseInt(umatchCountInput.value, 10);
            currentSettings.umatch_threshold = parseFloat(umatchThresholdInput.value);
            currentSettings.sysprompt = syspromptInput.value;
            localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
            applyAppearance();
            closeSettings();
        });
    }

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

    // Logout Handler
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
    // 6. Chat History Management
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

        const welcomeHeader = msgContainer.querySelector('.chat-bubble-enter');
        msgContainer.innerHTML = '';
        if (welcomeHeader) msgContainer.appendChild(welcomeHeader);

        const localHistory = getLocalHistory(ragId);
        if (localHistory && localHistory.length > 0) {
            localHistory.forEach(msg => {
                appendMessage(msg.message, msg.sender, msg.stats, msg.chunks, false);
            });
        }

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
    // 7. Message Rendering
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
                <div class="chat-bubble-user p-4 rounded-none text-on-surface text-sm md:text-base leading-relaxed break-words shadow-sm">
                    ${text}
                </div>
            `;
        } else {
            msgDiv.className = 'flex flex-col gap-1 max-w-[85%] self-start chat-bubble-enter-left';

            let detailsHtml = '';
            if (hasStats || hasChunks) {
                let statsHtml = '';
                if (hasStats) {
                    const displayedModel = stats.model || stats.provider || 'gpt-oss:20b';
                    statsHtml = `
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 mb-2 border-b border-glass-border/30 font-mono text-[11px] text-on-surface-variant">
                            <div>Latency: <strong class="text-primary">${stats.total_duration_sec || 0}s</strong></div>
                            <div>Tokens: <strong class="text-primary">${stats.eval_count || 0}</strong></div>
                            <div>Speed: <strong class="text-primary">${stats.tokens_per_sec || 0} t/s</strong></div>
                            <div class="truncate">Model: <strong class="text-primary">${displayedModel}</strong></div>
                        </div>
                    `;
                }

                let chunksHtml = '';
                if (hasChunks) {
                    chunksHtml = `
                        <div class="space-y-2 mt-2">
                            <div class="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">Matched Vector Chunks (${chunks.length}):</div>
                            ${chunks.map((c, i) => `
                                <div class="p-2.5 bg-surface-container border border-glass-border text-xs font-mono">
                                    <div class="flex justify-between text-primary font-bold mb-1">
                                        <span>Chunk ${i + 1} (${c.id})</span>
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
                        <summary class="flex items-center justify-between text-on-surface-variant hover:text-primary text-[11px] font-semibold uppercase tracking-wider select-none outline-none py-1 cursor-pointer">
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
                    <img src="LIMA_Logo.png" alt="Lima" class="w-4 h-4 object-contain border border-primary/40" />
                    <span class="text-[11px] font-semibold uppercase tracking-wider text-primary">Lima</span>
                </div>
                <div class="chat-bubble-bot p-4 rounded-none text-on-surface text-sm md:text-base leading-relaxed break-words shadow-sm">
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
    // 8. Sending Questions (/ask)
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
                appendMessage(`⚠️ <strong>Notice:</strong> ${errorMsg}`, 'bot');
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
        userInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 180) + 'px';
            if (this.value === '') {
                this.style.height = '44px';
            }
        });

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