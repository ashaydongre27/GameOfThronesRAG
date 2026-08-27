document.addEventListener('DOMContentLoaded', () => {
    // -------------------------------------------------------------
    // 1. Authentication Handlers (Login & Signup)
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
            loginBtn.textContent = 'Signing in...';

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
                loginBtn.textContent = 'Login';
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
            signupBtn.textContent = 'Creating account...';

            try {
                const response = await fetch('/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ first_name, last_name, email, username, password })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Account created successfully! Please log in.');
                    window.location.href = 'login.html';
                } else {
                    errorEl.textContent = data.error || 'Signup failed. Please try again.';
                }
            } catch (error) {
                errorEl.textContent = 'Connection error. Is the server running?';
            } finally {
                signupBtn.disabled = false;
                signupBtn.textContent = 'Sign Up';
            }
        });
        return;
    }

    // -------------------------------------------------------------
    // 2. Authentication & Session Verification
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

    // Set user greeting / badge
    const sidebarUsername = document.getElementById('sidebarUsername');
    const welcomeGreeting = document.getElementById('welcomeGreeting');
    if (sidebarUsername && currentUser.username) {
        sidebarUsername.textContent = currentUser.first_name ? `${currentUser.first_name}` : currentUser.username;
    }
    if (welcomeGreeting && currentUser.first_name) {
        welcomeGreeting.textContent = `Welcome back, ${currentUser.first_name}!`;
    }

    // -------------------------------------------------------------
    // 3. Themes & Available RAGs
    // -------------------------------------------------------------
    const themes = {
        midnight: { c1: "#0f172a", c2: "#1e293b" },
        dark: { c1: "#000000", c2: "#121212" },
        cosmic: { c1: "#6a11cb", c2: "#2575fc" },
        ocean: { c1: "#2b5876", c2: "#4e4376" },
        sunset: { c1: "#ff512f", c2: "#dd2476" },
        forest: { c1: "#11998e", c2: "#38ef7d" },
        light: { c1: "#e2e8f0", c2: "#cbd5e1" }
    };

    const availableRAGs = [
        { id: "game_of_thrones", name: "Game of Thrones", desc: "Westeros and beyond — houses, battles, lore, and the complete saga.", icon: "fa-dragon" },
        { id: "spiderman", name: "Spiderman", desc: "Everything about the Spiderman universe — characters, storylines, and lore.", icon: "fa-spider" },
        { id: "apollo_11", name: "Apollo 11", desc: "The historic Moon landing mission — crew, timeline, and legacy.", icon: "fa-rocket" }
    ];

    let currentRAG = null;
    let currentSettings = {
        themeProfile: "midnight",
        color1: "#0f172a",
        color2: "#1e293b",
        ollama_base_url: "",
        ollama_api_key: "",
        usermodel: "gemma4:31b-cloud",
        usertemperature: 0.5,
        umatch_count: 10,
        umatch_threshold: 0.4,
        sysprompt: "You are a helpful assistant. Use the following context to answer the user's question. If you don't know the answer based on the context, just say that you don't know."
    };

    // DOM Elements
    const homeBtn = document.getElementById('homeBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const homeView = document.getElementById('homeView');
    const chatView = document.getElementById('chatView');
    const viewTitle = document.getElementById('viewTitle');
    const ragContextLabel = document.getElementById('ragContextLabel');
    const clearChatBtn = document.getElementById('clearChatBtn');
    const ragGrid = document.getElementById('ragGrid');
    const chatArea = document.getElementById('chatArea');
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const themeProfileSelect = document.getElementById('themeProfile');
    const color1Input = document.getElementById('color1');
    const color2Input = document.getElementById('color2');
    const ollamaBaseUrlInput = document.getElementById('ollama_base_url');
    const ollamaApiKeyInput = document.getElementById('ollama_api_key');
    const usermodelInput = document.getElementById('usermodel');
    const usertemperatureInput = document.getElementById('usertemperature');
    const tempValSpan = document.getElementById('tempVal');
    const umatchCountInput = document.getElementById('umatch_count');
    const umatchThresholdInput = document.getElementById('umatch_threshold');
    const threshValSpan = document.getElementById('threshVal');
    const syspromptInput = document.getElementById('sysprompt');

    // -------------------------------------------------------------
    // 4. Settings Management
    // -------------------------------------------------------------
    function loadSettings() {
        const saved = localStorage.getItem('ragSettings');
        if (saved) {
            try {
                currentSettings = { ...currentSettings, ...JSON.parse(saved) };
            } catch (e) {
                console.error("Error loading settings:", e);
            }
        }
        applySettingsToUI();
        applyTheme();
    }

    function applySettingsToUI() {
        if (themeProfileSelect) themeProfileSelect.value = currentSettings.themeProfile || "midnight";
        if (color1Input) color1Input.value = currentSettings.color1 || "#0f172a";
        if (color2Input) color2Input.value = currentSettings.color2 || "#1e293b";
        if (ollamaBaseUrlInput) ollamaBaseUrlInput.value = currentSettings.ollama_base_url || "";
        if (ollamaApiKeyInput) ollamaApiKeyInput.value = currentSettings.ollama_api_key || "";
        if (usermodelInput) usermodelInput.value = currentSettings.usermodel || "gemma4:31b-cloud";
        if (usertemperatureInput) usertemperatureInput.value = currentSettings.usertemperature;
        if (tempValSpan) tempValSpan.textContent = currentSettings.usertemperature;
        if (umatchCountInput) umatchCountInput.value = currentSettings.umatch_count;
        if (umatchThresholdInput) umatchThresholdInput.value = currentSettings.umatch_threshold;
        if (threshValSpan) threshValSpan.textContent = currentSettings.umatch_threshold;
        if (syspromptInput) syspromptInput.value = currentSettings.sysprompt;
    }

    function applyTheme() {
        document.documentElement.style.setProperty('--gradient-start', currentSettings.color1 || "#0f172a");
        document.documentElement.style.setProperty('--gradient-end', currentSettings.color2 || "#1e293b");
    }

    // -------------------------------------------------------------
    // 5. RAG Cards & Navigation
    // -------------------------------------------------------------
    function renderRAGs() {
        if (!ragGrid) return;
        ragGrid.innerHTML = '';
        availableRAGs.forEach(rag => {
            const card = document.createElement('div');
            card.className = 'rag-card';
            card.innerHTML = `
                <i class="fas ${rag.icon}"></i>
                <h3>${rag.name}</h3>
                <p>${rag.desc}</p>
                <div class="rag-card-footer">
                    <span class="rag-status"><i class="fas fa-comments"></i> Open Chat</span>
                </div>
            `;
            card.addEventListener('click', () => selectRAG(rag));
            ragGrid.appendChild(card);
        });
    }

    function showHome() {
        homeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        viewTitle.textContent = "Home";
        ragContextLabel.classList.add('hidden');
        if (clearChatBtn) clearChatBtn.classList.add('hidden');
        homeBtn.classList.add('active');
        currentRAG = null;
    }

    async function selectRAG(rag) {
        currentRAG = rag;
        homeView.classList.add('hidden');
        chatView.classList.remove('hidden');
        viewTitle.textContent = rag.name;
        ragContextLabel.textContent = "Active Knowledge Base";
        ragContextLabel.classList.remove('hidden');
        if (clearChatBtn) clearChatBtn.classList.remove('hidden');
        homeBtn.classList.remove('active');

        await loadChatHistory(rag.id, rag.name);
    }

    // -------------------------------------------------------------
    // 6. Chat History Management (Local & Supabase Database)
    // -------------------------------------------------------------
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
            console.error("Local storage error:", e);
        }
    }

    async function loadChatHistory(ragId, ragName) {
        chatArea.innerHTML = '';

        // 1. Load locally first for instant display
        const localHistory = getLocalHistory(ragId);
        if (localHistory && localHistory.length > 0) {
            localHistory.forEach(msg => {
                appendMessage(msg.message, msg.sender, msg.stats, msg.chunks, false);
            });
        }

        // 2. Query cloud database in background to synchronize
        if (currentUser && currentUser.username) {
            try {
                const res = await fetch(`/history?username=${encodeURIComponent(currentUser.username)}&rag_id=${encodeURIComponent(ragId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
                        // If cloud returned history and it's newer/different, re-render
                        if (JSON.stringify(data.messages) !== JSON.stringify(localHistory)) {
                            chatArea.innerHTML = '';
                            data.messages.forEach(msg => {
                                appendMessage(msg.message, msg.sender, msg.stats, msg.chunks, false);
                            });
                            saveLocalHistory(ragId, data.messages);
                        }
                    }
                }
            } catch (err) {
                console.warn("Could not sync remote chat history:", err);
            }
        }

        // If after checking both, chat is still empty, add default welcome message
        if (chatArea.children.length === 0) {
            appendMessage(
                `Loaded context: <strong>${ragName}</strong>. Ask me anything about it! Your conversation history will be saved here.`,
                'bot',
                null,
                null,
                false
            );
        }

        chatArea.scrollTop = chatArea.scrollHeight;
    }

    async function persistMessageTurn(userQuery, botAnswer, stats, chunks) {
        if (!currentRAG) return;
        const ragId = currentRAG.id;

        // 1. Update local cache
        const history = getLocalHistory(ragId);
        const userMsg = { sender: 'user', message: userQuery, created_at: new Date().toISOString() };
        const botMsg = { sender: 'bot', message: botAnswer, stats: stats, chunks: chunks, created_at: new Date().toISOString() };
        history.push(userMsg);
        history.push(botMsg);
        saveLocalHistory(ragId, history);

        // 2. Persist to backend Supabase
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
                console.warn("Error posting history to server:", err);
            }
        }
    }

    async function handleClearChat() {
        if (!currentRAG) return;
        const confirmClear = confirm(`Are you sure you want to clear chat history for ${currentRAG.name}?`);
        if (!confirmClear) return;

        // Clear local storage
        saveLocalHistory(currentRAG.id, []);

        // Clear cloud database
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
                console.warn("Error deleting remote history:", err);
            }
        }

        // Reset chat view
        chatArea.innerHTML = '';
        appendMessage(
            `Conversation cleared for <strong>${currentRAG.name}</strong>. Ask a new question below!`,
            'bot',
            null,
            null,
            false
        );
    }

    // -------------------------------------------------------------
    // 7. Message Rendering
    // -------------------------------------------------------------
    function appendMessage(text, sender, stats = null, chunks = null, autoScroll = true) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.innerHTML = text;
        msgDiv.appendChild(contentDiv);

        const hasStats = stats && typeof stats === 'object' && Object.keys(stats).length > 0;
        const hasChunks = Array.isArray(chunks) && chunks.length > 0;

        if (hasStats || hasChunks) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta-dropdown';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'meta-toggle';
            toggleBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Response Details`;

            const metaContent = document.createElement('div');
            metaContent.className = 'meta-content hidden';

            if (hasStats && stats.total_duration_sec !== undefined) {
                const statsWrapper = document.createElement('div');
                statsWrapper.className = 'meta-stats';
                statsWrapper.innerHTML = `
                    <div class="meta-item">
                        <span>Total Time</span>
                        <strong>${stats.total_duration_sec} sec</strong>
                    </div>
                    <div class="meta-item">
                        <span>Tokens Generated</span>
                        <strong>${stats.eval_count || 0}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Speed</span>
                        <strong>${stats.tokens_per_sec || 0} tok/sec</strong>
                    </div>
                `;
                metaContent.appendChild(statsWrapper);
            }

            if (hasChunks) {
                const chunksWrapper = document.createElement('div');
                chunksWrapper.className = 'meta-chunks';
                chunksWrapper.innerHTML = '<span>Matched Chunks</span>';

                const chunkList = document.createElement('div');
                chunkList.className = 'chunk-list';
                chunks.forEach((chunk, index) => {
                    const chunkItem = document.createElement('div');
                    chunkItem.className = 'chunk-item';
                    chunkItem.innerHTML = `
                        <div class="chunk-header">Chunk ${index + 1} (ID: ${chunk.id} | Sim: ${chunk.similarity})</div>
                        <div class="chunk-text">${chunk.text}</div>
                    `;
                    chunkList.appendChild(chunkItem);
                });
                chunksWrapper.appendChild(chunkList);
                metaContent.appendChild(chunksWrapper);
            }

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                metaContent.classList.toggle('hidden');
                toggleBtn.classList.toggle('open');
            });

            metaDiv.appendChild(toggleBtn);
            metaDiv.appendChild(metaContent);
            msgDiv.appendChild(metaDiv);
        }

        chatArea.appendChild(msgDiv);
        if (autoScroll) {
            chatArea.scrollTop = chatArea.scrollHeight;
        }
        return msgDiv;
    }

    // -------------------------------------------------------------
    // 8. Sending Questions & API Interaction
    // -------------------------------------------------------------
    async function sendMessage() {
        const query = userInput.value.trim();
        if (!query || !currentRAG) return;

        appendMessage(query, 'user');
        userInput.value = '';
        userInput.style.height = 'auto';

        const typingMsg = appendMessage('<i class="fas fa-spinner fa-spin"></i> Thinking...', 'bot');
        typingMsg.classList.add('typing');

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
                    sysprompt: currentSettings.sysprompt,
                    ollama_base_url: currentSettings.ollama_base_url,
                    ollama_api_key: currentSettings.ollama_api_key
                })
            });

            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                console.error("Server returned non-JSON response:", errorText);
                throw new Error(`Server returned status ${response.status}. Please check server logs.`);
            }

            const data = await response.json();
            typingMsg.remove();

            if (!response.ok || data.error) {
                const errorMsg = data.error || `Server error (${response.status})`;
                appendMessage(`⚠️ <strong>Error:</strong> ${errorMsg}`, 'bot');
            } else {
                appendMessage(data.answer, 'bot', data.stats, data.chunks);
                // Persist turn to chat history
                persistMessageTurn(query, data.answer, data.stats, data.chunks);
            }
        } catch (error) {
            typingMsg.remove();
            appendMessage(`⚠️ <strong>Connection Error:</strong> ${error.message}`, 'bot');
        }
    }

    // -------------------------------------------------------------
    // 9. Event Listeners
    // -------------------------------------------------------------
    homeBtn.addEventListener('click', showHome);

    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', handleClearChat);
    }

    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    });

    // Settings Modal Listeners
    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    if (usertemperatureInput && tempValSpan) {
        usertemperatureInput.addEventListener('input', (e) => tempValSpan.textContent = e.target.value);
    }
    if (umatchThresholdInput && threshValSpan) {
        umatchThresholdInput.addEventListener('input', (e) => threshValSpan.textContent = e.target.value);
    }

    themeProfileSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (selected !== "custom" && themes[selected]) {
            color1Input.value = themes[selected].c1;
            color2Input.value = themes[selected].c2;
        }
    });

    color1Input.addEventListener('input', () => themeProfileSelect.value = "custom");
    color2Input.addEventListener('input', () => themeProfileSelect.value = "custom");

    saveSettingsBtn.addEventListener('click', () => {
        currentSettings = {
            themeProfile: themeProfileSelect.value,
            color1: color1Input.value,
            color2: color2Input.value,
            ollama_base_url: ollamaBaseUrlInput.value.trim(),
            ollama_api_key: ollamaApiKeyInput.value.trim(),
            usermodel: usermodelInput.value,
            usertemperature: parseFloat(usertemperatureInput.value),
            umatch_count: parseInt(umatchCountInput.value, 10),
            umatch_threshold: parseFloat(umatchThresholdInput.value),
            sysprompt: syspromptInput.value
        };
        localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
        applyTheme();
        settingsModal.classList.add('hidden');
    });

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${Math.min(userInput.scrollHeight, 120)}px`;
    });

    // -------------------------------------------------------------
    // 10. Initialization
    // -------------------------------------------------------------
    loadSettings();
    renderRAGs();
    showHome();
});