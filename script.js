document.addEventListener('DOMContentLoaded', () => {
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

    if (!sessionStorage.getItem('isAuthenticated')) {
        window.location.href = 'login.html';
        return;
    }

    const themes = {
        light: { c1: "#f5e9b1ff", c2: "#d2c645ff" },
        dark: { c1: "#000000ff", c2: "#000000ff" },
        midnight: { c1: "#0f172a", c2: "#1e293b" },
        cosmic: { c1: "#6a11cb", c2: "#2575fc" },
        ocean: { c1: "#2b5876", c2: "#4e4376" },
        sunset: { c1: "#ff512f", c2: "#dd2476" },
        forest: { c1: "#11998e", c2: "#38ef7d" }
    };

    const availableRAGs = [
        { id: "spiderman", name: "Spiderman", desc: "Everything about the Spiderman universe — characters, storylines, and lore.", icon: "fa-spider" },
        { id: "game_of_thrones", name: "Game of Thrones", desc: "Westeros and beyond — houses, battles, and the complete saga.", icon: "fa-dragon" },
        { id: "apollo_11", name: "Apollo 11", desc: "The historic Moon landing mission — crew, timeline, and legacy.", icon: "fa-rocket" }
    ];

    let currentRAG = null;
    let currentSettings = {
        themeProfile: "midnight",
        color1: "#0f172a",
        color2: "#1e293b",
        usermodel: "gemma4:31b-cloud",
        usertemperature: 0.5,
        umatch_count: 10,
        umatch_threshold: 0.4,
        sysprompt: "You are a helpful assistant. Use the following context to answer the user's question. \nIf you don't know the answer based on the context, just say that you don't know."
    };

    const homeBtn = document.getElementById('homeBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const homeView = document.getElementById('homeView');
    const chatView = document.getElementById('chatView');
    const viewTitle = document.getElementById('viewTitle');
    const ragContextLabel = document.getElementById('ragContextLabel');
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
    const usermodelInput = document.getElementById('usermodel');
    const usertemperatureInput = document.getElementById('usertemperature');
    const tempValSpan = document.getElementById('tempVal');
    const umatchCountInput = document.getElementById('umatch_count');
    const umatchThresholdInput = document.getElementById('umatch_threshold');
    const threshValSpan = document.getElementById('threshVal');
    const syspromptInput = document.getElementById('sysprompt');

    function loadSettings() {
        const saved = localStorage.getItem('ragSettings');
        if (saved) currentSettings = JSON.parse(saved);
        applySettingsToUI();
        applyTheme();
    }

    function applySettingsToUI() {
        themeProfileSelect.value = currentSettings.themeProfile;
        color1Input.value = currentSettings.color1;
        color2Input.value = currentSettings.color2;
        usermodelInput.value = currentSettings.usermodel;
        usertemperatureInput.value = currentSettings.usertemperature;
        tempValSpan.textContent = currentSettings.usertemperature;
        umatchCountInput.value = currentSettings.umatch_count;
        umatchThresholdInput.value = currentSettings.umatch_threshold;
        threshValSpan.textContent = currentSettings.umatch_threshold;
        syspromptInput.value = currentSettings.sysprompt;
    }

    function applyTheme() {
        document.documentElement.style.setProperty('--gradient-start', currentSettings.color1);
        document.documentElement.style.setProperty('--gradient-end', currentSettings.color2);
    }

    function renderRAGs() {
        ragGrid.innerHTML = '';
        availableRAGs.forEach(rag => {
            const card = document.createElement('div');
            card.className = 'rag-card';
            card.innerHTML = `
                <i class="fas ${rag.icon}"></i>
                <h3>${rag.name}</h3>
                <p>${rag.desc}</p>
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
        homeBtn.classList.add('active');
        currentRAG = null;
    }

    function selectRAG(rag) {
        currentRAG = rag;
        homeView.classList.add('hidden');
        chatView.classList.remove('hidden');
        viewTitle.textContent = "Chat";
        ragContextLabel.textContent = rag.name;
        ragContextLabel.classList.remove('hidden');
        homeBtn.classList.remove('active');
        chatArea.innerHTML = `
            <div class="message bot">
                <div class="message-content">Loaded context: <strong>${rag.name}</strong>. Ask me anything about it!</div>
            </div>
        `;
    }

    homeBtn.addEventListener('click', showHome);
    logoutBtn.addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'login.html';
    });

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    usertemperatureInput.addEventListener('input', (e) => tempValSpan.textContent = e.target.value);
    umatchThresholdInput.addEventListener('input', (e) => threshValSpan.textContent = e.target.value);

    themeProfileSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (selected !== "custom") {
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
            usermodel: usermodelInput.value,
            usertemperature: parseFloat(usertemperatureInput.value),
            umatch_count: parseInt(umatchCountInput.value),
            umatch_threshold: parseFloat(umatchThresholdInput.value),
            sysprompt: syspromptInput.value
        };
        localStorage.setItem('ragSettings', JSON.stringify(currentSettings));
        applyTheme();
        settingsModal.classList.add('hidden');
    });

    function appendMessage(text, sender, stats = null, chunks = null) {
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

            if (hasStats) {
                const statsWrapper = document.createElement('div');
                statsWrapper.className = 'meta-stats';
                statsWrapper.innerHTML = `
                    <div class="meta-item">
                        <span>Total Time</span>
                        <strong>${stats.total_duration_sec} sec</strong>
                    </div>
                    <div class="meta-item">
                        <span>Tokens Generated</span>
                        <strong>${stats.eval_count}</strong>
                    </div>
                    <div class="meta-item">
                        <span>Speed</span>
                        <strong>${stats.tokens_per_sec} tok/sec</strong>
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

            // e.stopPropagation ensures clicking the button doesn't trigger outer elements
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
        chatArea.scrollTop = chatArea.scrollHeight;
        return msgDiv;
    }

    async function sendMessage() {
        const query = userInput.value.trim();
        if (!query || !currentRAG) return;

        appendMessage(query, 'user');
        userInput.value = '';
        userInput.style.height = 'auto';

        const typingMsg = appendMessage('Thinking...', 'bot');
        typingMsg.classList.add('typing');

        try {
            const response = await fetch('/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    rag_id: currentRAG.id,
                    usermodel: currentSettings.usermodel,
                    usertemperature: currentSettings.usertemperature,
                    umatch_count: currentSettings.umatch_count,
                    umatch_threshold: currentSettings.umatch_threshold,
                    sysprompt: currentSettings.sysprompt
                })
            });

            const contentType = response.headers.get("content-type");

            if (!contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                console.error("Server returned non-JSON response:", errorText);
                throw new Error(`Server error! Are you running this on port 5000? (Status: ${response.status})`);
            }

            const data = await response.json();
            typingMsg.remove();

            if (!response.ok) {
                appendMessage(`Backend Error: ${data.error || `Unknown server error`}`, 'bot');
            } else if (data.error) {
                appendMessage(`Backend Error: ${data.error}`, 'bot');
            } else {
                appendMessage(data.answer, 'bot', data.stats, data.chunks);
            }
        } catch (error) {
            typingMsg.remove();
            appendMessage(`Network Error: ${error.message}`, 'bot');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${userInput.scrollHeight}px`;
    });

    loadSettings();
    renderRAGs();
    showHome();
});