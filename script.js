document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. MOCK USER DB & AUTHENTICATION
    // ==========================================
    const validUsers = {
        "admin": "password123",
        "user": "1234"
    };

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const errorEl = document.getElementById('loginError');

            if (validUsers[username] && validUsers[username] === password) {
                sessionStorage.setItem('isAuthenticated', 'true');
                sessionStorage.setItem('currentUser', username);
                window.location.href = 'index.html';
            } else {
                errorEl.textContent = "Invalid username or password.";
            }
        });
        return;
    }

    if (!sessionStorage.getItem('isAuthenticated')) {
        window.location.href = 'login.html';
        return;
    }

    // ==========================================
    // 2. APP STATE & ELEMENTS
    // ==========================================
    const themes = {
        midnight: { c1: "#0f172a", c2: "#1e293b" },
        cosmic: { c1: "#6a11cb", c2: "#2575fc" },
        ocean: { c1: "#2b5876", c2: "#4e4376" },
        sunset: { c1: "#ff512f", c2: "#dd2476" },
        forest: { c1: "#11998e", c2: "#38ef7d" }
    };

    const availableRAGs = [
        { id: "mainragvdb", name: "General Knowledge", desc: "Main database containing all general documents and FAQs.", icon: "fa-globe" },
        { id: "hr_rag", name: "HR Policies", desc: "Employee handbook, leave policies, and onboarding docs.", icon: "fa-users" },
        { id: "tech_rag", name: "Tech Support", desc: "Technical documentation, API references, and bug fixes.", icon: "fa-code" },
        { id: "legal_rag", name: "Legal Contracts", desc: "Standard operating procedures and legal templates.", icon: "fa-gavel" }
    ];

    let currentRAG = null;
    let currentSettings = {
        themeProfile: "midnight",
        color1: "#0f172a",
        color2: "#1e293b",
        usermodel: "granite4:350m",
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

    // ==========================================
    // 3. INITIALIZATION
    // ==========================================
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

    // ==========================================
    // 4. NAVIGATION & VIEWS
    // ==========================================
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

    // ==========================================
    // 5. SETTINGS MODAL LOGIC
    // ==========================================
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

    // ==========================================
    // 6. CHAT LOGIC
    // ==========================================
    function appendMessage(text, sender, stats = null, chunks = []) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', sender);

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');
        contentDiv.innerHTML = text;
        msgDiv.appendChild(contentDiv);

        // If stats or chunks exist, build the dropdown
        if (stats || chunks.length > 0) {
            const metaDiv = document.createElement('div');
            metaDiv.className = 'meta-dropdown';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'meta-toggle';
            toggleBtn.innerHTML = `<i class="fas fa-chevron-down"></i> Response Details`;

            const metaContent = document.createElement('div');
            metaContent.className = 'meta-content hidden';

            // Add Stats
            if (stats) {
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

            // Add Chunks
            if (chunks.length > 0) {
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

            toggleBtn.addEventListener('click', () => {
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
            if (!response.ok || !contentType || !contentType.includes("application/json")) {
                const errorText = await response.text();
                console.error("Server returned non-JSON response:", errorText);
                throw new Error(`Server error! Are you running this on port 5000? (Status: ${response.status})`);
            }

            const data = await response.json();
            typingMsg.remove();

            if (data.error) {
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