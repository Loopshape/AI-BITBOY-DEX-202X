
import { GoogleGenAI, Chat } from "@google/genai";

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const connectModal = document.getElementById('connect-modal') as HTMLElement;
    const connectBtn = document.getElementById('header-connect-btn') as HTMLElement;
    const disconnectBtn = document.getElementById('header-disconnect-btn') as HTMLElement;
    const closeModalBtn = document.querySelector('.close-modal') as HTMLElement;
    const walletInfo = document.getElementById('wallet-info') as HTMLElement;
    const walletStatus = document.getElementById('wallet-status-indicator') as HTMLElement;
    const terminal = document.getElementById('terminal') as HTMLElement;
    const previewArea = document.getElementById('preview-area') as HTMLElement;
    const previewPlaceholder = document.getElementById('preview-area-placeholder') as HTMLElement;
    const resetBtn = document.getElementById('reset-btn') as HTMLElement;
    const propertiesEditor = document.getElementById('properties-editor') as HTMLElement;
    const toastContainer = document.getElementById('toastContainer') as HTMLElement;
    const components = document.querySelectorAll('.component-item');
    const adminControlsModal = document.getElementById('admin-controls-modal') as HTMLElement;
    const openAdminControlsBtn = document.getElementById('open-admin-controls-btn') as HTMLElement;
    const closeAdminControlsBtn = adminControlsModal.querySelector('.admin-close-btn') as HTMLElement;
    const contextMenu = document.getElementById('component-context-menu') as HTMLElement;


    // State
    let isWalletConnected = false;
    let selectedElement: HTMLElement | null = null;
    let contextElement: HTMLElement | null = null;
    let aiChat: Chat | null = null;

    // --- Gemini AI Initialization ---
    const API_KEY = process.env.API_KEY;
    let ai: GoogleGenAI | null = null;
    if (API_KEY) {
        try {
            ai = new GoogleGenAI({ apiKey: API_KEY });
        } catch (error) {
            console.error("Failed to initialize GoogleGenAI:", error);
            logToTerminal('Failed to initialize AI. Check API Key.', 'error');
        }
    } else {
        logToTerminal('API_KEY environment variable not set.', 'warning');
    }

    // --- Core Functions ---

    function logToTerminal(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.classList.add('log-entry');
        entry.innerHTML = `<span class="log-timestamp">${timestamp}</span> <span class="log-${type}">${message}</span>`;
        terminal.appendChild(entry);
        terminal.scrollTop = terminal.scrollHeight;
    }
    
    function showToast(message: string, type: 'success' | 'warning' | 'error' = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    function simulateCliWalletConnection(): Promise<{ address: string; balance: number }> {
        logToTerminal('Establishing connection to CLI wallet...');
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate a 90% success rate
                if (Math.random() > 0.1) {
                    const address = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                    const balance = Math.random() * 5.2; // Simulate a balance between 0 and 5.2 ETH
                    resolve({ address, balance });
                } else {
                    reject(new Error('Connection timed out or was rejected by the user.'));
                }
            }, 1500);
        });
    }

    async function connectWallet() {
        logToTerminal('Attempting wallet connection...');
        connectModal.style.display = 'none'; // Close modal immediately for better UX
        showToast('Connecting...', 'success');

        try {
            const walletData = await simulateCliWalletConnection();
            
            const headerAddressEl = document.getElementById('header-wallet-address') as HTMLElement;
            const headerBalanceEl = document.getElementById('header-wallet-balance') as HTMLElement;

            // Format and update UI
            headerAddressEl.textContent = `${walletData.address.substring(0, 6)}...${walletData.address.substring(walletData.address.length - 4)}`;
            headerBalanceEl.textContent = `${walletData.balance.toFixed(4)} ETH`;

            isWalletConnected = true;
            walletInfo.style.display = 'flex';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'flex';
            walletStatus.classList.add('connected');
            walletStatus.classList.remove('disconnected');
            logToTerminal(`Wallet connected successfully. Address: ${walletData.address}`, 'success');
            showToast('Wallet connected!', 'success');
            updateSwapButton();
        } catch (error: any) {
            logToTerminal(`Wallet connection failed: ${error.message}`, 'error');
            showToast(error.message || 'Connection failed.', 'error');
            disconnectWallet(); // Ensure UI is in a disconnected state
        }
    }

    function disconnectWallet() {
        isWalletConnected = false;
        walletInfo.style.display = 'none';
        connectBtn.style.display = 'flex';
        disconnectBtn.style.display = 'none';
        walletStatus.classList.add('disconnected');
        walletStatus.classList.remove('connected');

        // Reset header info to placeholders
        const headerAddressEl = document.getElementById('header-wallet-address') as HTMLElement;
        const headerBalanceEl = document.getElementById('header-wallet-balance') as HTMLElement;
        headerAddressEl.textContent = '0x1234...5678';
        headerBalanceEl.textContent = '0.00 ETH';

        logToTerminal('Wallet disconnected.');
        updateSwapButton();
    }
    
    function updateSwapButton() {
        const swapButton = previewArea.querySelector('.swap-button') as HTMLButtonElement;
        if (swapButton) {
            if (isWalletConnected) {
                swapButton.textContent = 'Swap';
                swapButton.disabled = false;
            } else {
                swapButton.textContent = 'Connect Wallet';
                swapButton.disabled = true;
            }
        }
    }

    function addComponentToPreview(type: string, x: number, y: number) {
        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'none';
        }
        
        let componentHTML = '';
        switch (type) {
            case 'wallet-balance':
                componentHTML = `
                    <div class="app-component wallet-balance-component" data-type="wallet-balance">
                        <h3><i class="fas fa-wallet"></i> Wallet Balance</h3>
                        <div class="component-content">
                             <div class="token-balance-list">
                                <div class="token-balance-item">
                                    <img src="https://cryptologos.cc/logos/ethereum-eth-logo.png" alt="ETH" class="token-balance-icon">
                                    <div class="token-balance-info"><span class="token-balance-name">Ethereum</span></div>
                                    <div class="token-balance-amount"><span>2.5 ETH</span><small>$4,250.75</small></div>
                                </div>
                                <div class="token-balance-item">
                                    <img src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" alt="USDC" class="token-balance-icon">
                                    <div class="token-balance-info"><span class="token-balance-name">USD Coin</span></div>
                                    <div class="token-balance-amount"><span>1,532.5 USDC</span><small>$1,532.50</small></div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                break;
            case 'tx-history':
                componentHTML = `
                    <div class="app-component tx-history-component" data-type="tx-history">
                        <h3><i class="fas fa-history"></i> Transaction History</h3>
                        <div class="component-content">
                            <div class="component-content-placeholder">
                                <i class="fas fa-exchange-alt"></i>
                                <p>No transactions to display.</p>
                                <p><small>Connect wallet to see history.</small></p>
                            </div>
                        </div>
                    </div>`;
                break;
            case 'ai-assistant':
                 componentHTML = `
                    <div class="app-component ai-assistant-component" data-type="ai-assistant">
                        <div class="ai-assistant-header">
                             <h3><i class="fas fa-robot"></i> AI Assistant</h3>
                             <div class="ai-assistant-controls">
                                 <label class="tts-toggle">
                                     <input type="checkbox" checked>
                                     <span class="slider"></span>
                                 </label>
                                 <i class="fas fa-volume-up tts-status-icon"></i>
                             </div>
                        </div>
                        <div class="component-content">
                            <div class="ai-chat-messages">
                                <div class="ai-message">
                                    <span class="ai-message-text">Hello! I'm your crypto expert assistant. Ask me anything about Web3, tokens, or DeFi.</span>
                                </div>
                            </div>
                            <form class="ai-chat-input-form">
                                <input type="text" placeholder="Ask a question..." required>
                                <button type="button" class="mic-btn"><i class="fas fa-microphone"></i></button>
                                <button type="submit"><i class="fas fa-paper-plane"></i></button>
                            </form>
                        </div>
                    </div>
                `;
                break;
            case 'info-framework':
                componentHTML = `
                    <div class="app-component fundamental-component" data-type="info-framework">
                        <h3><i class="fas fa-project-diagram"></i> Info Framework</h3>
                        <div class="data-grid">
                            <div class="data-item"><h4>INDEX</h4><p>Data organization</p></div>
                            <div class="data-item"><h4>SCORE</h4><p>Evaluation metric</p></div>
                            <div class="data-item"><h4>DIRECTIVE</h4><p>Execution guidance</p></div>
                            <div class="data-item"><h4>CONVENTION</h4><p>Standard protocols</p></div>
                            <div class="data-item"><h4>IP</h4><p>Intellectual property</p></div>
                            <div class="data-item"><h4>CAPITALISM</h4><p>Economic system</p></div>
                        </div>
                    </div>
                `;
                break;
            case 'system-status':
                componentHTML = `
                    <div class="app-component fundamental-component" data-type="system-status">
                        <h3><i class="fas fa-network-wired"></i> System Status</h3>
                        <div class="data-grid">
                            <div class="data-item"><h4>COM</h4><p>Communication</p></div>
                            <div class="data-item"><h4>SYSTEM</h4><p>Architecture</p></div>
                            <div class="data-item"><h4>MEDIAN</h4><p>Central tendency</p></div>
                            <div class="data-item"><h4>INFRA</h4><p>Foundation</p></div>
                            <div class="data-item"><h4>IDQ</h4><p>Identity quantum</p></div>
                            <div class="data-item"><h4>CBDC</h4><p>Digital currency</p></div>
                        </div>
                    </div>
                `;
                break;
            case 'block-explorer':
                componentHTML = `
                    <div class="app-component block-explorer-component" data-type="block-explorer">
                        <h3><i class="fas fa-cube"></i> Block Explorer</h3>
                        <div class="block-structure">
                            <div class="block-item">
                                <div class="block-item-header"><span>Timestamp</span><span>B</span></div>
                                <p>Records transaction time</p>
                            </div>
                            <div class="block-item">
                                <div class="block-item-header"><span>Pi</span><span>hash</span></div>
                                <p>Cryptographic hashing</p>
                            </div>
                            <div class="block-item">
                                <div class="block-item-header"><span>Index</span><span>D</span></div>
                                <p>Position identifier</p>
                            </div>
                            <div class="block-item">
                                <div class="block-item-header"><span>Block</span><span>Chain</span></div>
                                <p>Linked data structure</p>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'data-analysis':
                componentHTML = `
                    <div class="app-component data-analysis-component" data-type="data-analysis">
                        <h3><i class="fas fa-brain"></i> Data Analysis</h3>
                        <div class="analysis-process">
                            <div class="process-step"><i class="fas fa-wave-square"></i><span>SPECTRUM</span></div>
                            <div class="process-step"><i class="fas fa-filter"></i><span>SORT</span></div>
                            <div class="process-step"><i class="fas fa-eye"></i><span>RECOGNIZE</span></div>
                            <div class="process-step"><i class="fas fa-bullseye"></i><span>FOCUS</span></div>
                            <div class="process-step"><i class="fas fa-search"></i><span>QUEST</span></div>
                            <div class="process-step"><i class="fas fa-graduation-cap"></i><span>LEARN</span></div>
                        </div>
                    </div>
                `;
                break;
            case 'entropy-parser':
                componentHTML = `
                    <div class="app-component entropy-parser-component" data-type="entropy-parser">
                        <h3><i class="fas fa-atom"></i> Entropy Parser</h3>
                        <div class="parser-container">
                            <div class="entropy-input">
                                <h4>RAW ENTROPY STREAM</h4>
                                <div class="entropy-visualizer">
                                    <div class="entropy-bar"></div>
                                    <div class="entropy-bar"></div>
                                    <div class="entropy-bar"></div>
                                    <div class="entropy-bar"></div>
                                </div>
                            </div>
                            <div class="parser-core">
                                <i class="fas fa-cogs"></i>
                                <span>PARSING</span>
                            </div>
                            <div class="entropy-output">
                                <h4>PARSED SIGNALS</h4>
                                <div class="signal-item">
                                    <span>Signal Strength</span>
                                    <span class="signal-value high">92.7%</span>
                                </div>
                                <div class="signal-item">
                                    <span>Pattern Detected</span>
                                    <span class="signal-value">VOL-SPIKE</span>
                                </div>
                                 <div class="signal-item">
                                    <span>Confidence</span>
                                    <span class="signal-value med">78.4%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                break;
            case 'sentinel-protocol':
                componentHTML = `
                    <div class="app-component sentinel-protocol-component" data-type="sentinel-protocol">
                        <h3><i class="fas fa-shield-halved"></i> Sentinel Protocol Hub</h3>
                        <div class="sentinel-tabs">
                            <button class="sentinel-tab active" data-tab="staking">Staking</button>
                            <button class="sentinel-tab" data-tab="governance">Governance</button>
                            <button class="sentinel-tab" data-tab="alpha">Alpha Oracles</button>
                        </div>
                        <div class="sentinel-content">
                            <div class="sentinel-tab-content active" data-tab-content="staking">
                                <h4>Staking Dashboard</h4>
                                <div class="staking-metrics">
                                    <div class="metric-item">
                                        <span>Total Value Locked</span>
                                        <p>$125.4M</p>
                                    </div>
                                    <div class="metric-item">
                                        <span>Your Stake</span>
                                        <p>0.00 SNTL</p>
                                    </div>
                                    <div class="metric-item">
                                        <span>APR</span>
                                        <p>12.5%</p>
                                    </div>
                                </div>
                                <div class="staking-actions">
                                    <button class="btn btn-primary">Stake SNTL</button>
                                    <button class="btn btn-secondary">Unstake</button>
                                </div>
                            </div>
                            <div class="sentinel-tab-content" data-tab-content="governance">
                                <h4>Active Governance Proposals</h4>
                                <div class="proposal-list">
                                    <div class="proposal-item">
                                        <p class="proposal-title">SIP-042: Increase validator rewards by 5%</p>
                                        <div class="proposal-status active-voting">Voting Active</div>
                                        <div class="proposal-progress">
                                            <div class="progress-bar" style="width: 65%;"></div>
                                        </div>
                                    </div>
                                    <div class="proposal-item">
                                        <p class="proposal-title">SIP-041: Integrate new cross-chain bridge</p>
                                         <div class="proposal-status passed">Passed</div>
                                         <div class="proposal-progress">
                                            <div class="progress-bar" style="width: 82%;"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="sentinel-tab-content" data-tab-content="alpha">
                                <h4>Market Sentiment Analysis</h4>
                                <div class="sentiment-module">
                                    <div class="sentiment-gauge">
                                        <div class="gauge-dial"></div>
                                        <div class="gauge-needle"></div>
                                        <div class="gauge-center"></div>
                                        <div class="sentiment-score-display">
                                            <span class="sentiment-score">72</span>
                                            <span class="sentiment-label">Greed</span>
                                        </div>
                                    </div>
                                    <div class="sentiment-drivers">
                                         <h5>Key Drivers:</h5>
                                         <ul class="drivers-list">
                                            <!-- Drivers will be populated by JS -->
                                         </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;
                break;
        }
        
        if (componentHTML) {
            previewArea.insertAdjacentHTML('beforeend', componentHTML);
            logToTerminal(`Component "${type}" added to preview.`);
            if (type === 'ai-assistant') {
                const newAssistant = previewArea.querySelector('.ai-assistant-component:last-child');
                if (newAssistant) {
                    setupAIAssistant(newAssistant as HTMLElement);
                }
            } else if (type === 'sentinel-protocol') {
                const newSentinel = previewArea.querySelector('.sentinel-protocol-component:last-child');
                if (newSentinel) {
                    setupSentinelProtocol(newSentinel as HTMLElement);
                }
            }
        }
    }
    
    function resetPreview() {
        // Leave the mandatory DEX module, remove everything else.
        const componentsToRemove = previewArea.querySelectorAll('.app-component:not(.dex-module), .generated-component');
        componentsToRemove.forEach(c => c.remove());
        
        if (previewArea.children.length <= 1) { // only dex module is left
            if (previewPlaceholder) {
                previewPlaceholder.style.display = 'flex';
            }
        }
        
        propertiesEditor.innerHTML = '<p class="properties-placeholder">Select a DEX element to edit its properties.</p>';
        if (selectedElement) {
            selectedElement.classList.remove('selected');
            selectedElement = null;
        }
        logToTerminal('Preview area has been reset.', 'warning');
    }

    function selectElement(element: HTMLElement) {
        if (selectedElement) {
            selectedElement.classList.remove('selected');
        }
        selectedElement = element;
        selectedElement.classList.add('selected');
        generatePropertiesEditor(selectedElement);
    }
    
    function generatePropertiesEditor(element: HTMLElement) {
        const part = element.dataset.editablePart;
        let editorHTML = '';

        if (part) {
            editorHTML += `<h3 class="panel-subtitle">${part} Properties</h3>`;
            switch (part) {
                case 'dex-title':
                    const title = element.textContent || 'Swap Tokens';
                    editorHTML += `
                        <div class="property-group">
                            <label for="title-text">Title Text</label>
                            <input type="text" id="title-text" value="${title}">
                        </div>`;
                    break;
                case 'dex-swap-box':
                     editorHTML += `
                        <div class="property-group">
                            <label for="bg-color">Background Color</label>
                            <input type="color" id="bg-color" value="#0f172a">
                        </div>
                         <div class="property-group">
                            <label for="border-radius">Border Radius (px)</label>
                            <input type="number" id="border-radius" value="12" min="0" max="30">
                        </div>`;
                    break;
                 case 'dex-swap-button':
                    editorHTML += `
                        <div class="property-group">
                             <label for="button-text">Button Text (Connected)</label>
                             <input type="text" id="button-text" value="Swap">
                        </div>`;
                    break;
            }
            propertiesEditor.innerHTML = editorHTML;
        } else {
             propertiesEditor.innerHTML = '<p class="properties-placeholder">This element is not editable.</p>';
        }
    }
    
    function updateElementStyle(property: string, value: string) {
        if (!selectedElement) return;

        const part = selectedElement.dataset.editablePart;
        switch (part) {
             case 'dex-title':
                if (property === 'textContent') {
                    selectedElement.textContent = value;
                }
                break;
            case 'dex-swap-box':
                if (property === 'backgroundColor') {
                    selectedElement.style.backgroundColor = value;
                } else if (property === 'borderRadius') {
                    selectedElement.style.borderRadius = `${value}px`;
                }
                break;
            case 'dex-swap-button':
                 if (property === 'textContent' && isWalletConnected) {
                    (selectedElement as HTMLButtonElement).textContent = value;
                }
                break;
        }
    }
    
    async function setupAIAssistant(assistantElement: HTMLElement) {
        const form = assistantElement.querySelector('.ai-chat-input-form') as HTMLFormElement;
        const input = assistantElement.querySelector('input[type="text"]') as HTMLInputElement;
        const submitButton = assistantElement.querySelector('button[type="submit"]') as HTMLButtonElement;
        const messagesContainer = assistantElement.querySelector('.ai-chat-messages') as HTMLElement;
        const micBtn = assistantElement.querySelector('.mic-btn') as HTMLButtonElement;
        const ttsToggle = assistantElement.querySelector('.tts-toggle input') as HTMLInputElement;
        const ttsStatusIcon = assistantElement.querySelector('.tts-status-icon') as HTMLElement;
        
        let isTTSEnabled = ttsToggle.checked;
        
        if (!ai) {
            const aiMessageDiv = document.createElement('div');
            aiMessageDiv.className = 'ai-message';
            aiMessageDiv.innerHTML = `<span class="ai-message-text">AI service is not available. Please check the API key.</span>`;
            messagesContainer.appendChild(aiMessageDiv);
            input.disabled = true;
            submitButton.disabled = true;
            micBtn.disabled = true;
            return;
        }

        if (!aiChat) {
             aiChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: "You are an expert in cryptocurrency, blockchain technology, and decentralized finance (DeFi). Provide clear, concise, and easy-to-understand answers. Be friendly and helpful.",
                },
            });
        }
        
        // --- Text-to-Speech ---
        ttsToggle.addEventListener('change', () => {
            isTTSEnabled = ttsToggle.checked;
            if (isTTSEnabled) {
                ttsStatusIcon.classList.replace('fa-volume-mute', 'fa-volume-up');
            } else {
                ttsStatusIcon.classList.replace('fa-volume-up', 'fa-volume-mute');
                speechSynthesis.cancel(); // Stop any ongoing speech
            }
        });

        function speak(text: string, messageElement: HTMLElement) {
            // FIX: Corrected operator precedence to check for 'speechSynthesis' in window.
            if (!isTTSEnabled || !('speechSynthesis' in window)) return;
            
            speechSynthesis.cancel(); // Stop previous speech
            
            const utterance = new SpeechSynthesisUtterance(text);
            const speakerIcon = document.createElement('i');
            speakerIcon.className = 'fas fa-volume-up speaking-indicator';
            messageElement.appendChild(speakerIcon);

            utterance.onend = () => {
                speakerIcon.remove();
            };
            utterance.onerror = () => {
                 speakerIcon.remove();
            };

            speechSynthesis.speak(utterance);
        }

        // --- Speech-to-Text ---
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        let recognition: any | null = null;
        let isListening = false;

        if (SpeechRecognition) {
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.lang = 'en-US';
            recognition.interimResults = false;

            micBtn.addEventListener('click', () => {
                if (isListening) {
                    recognition.stop();
                } else {
                    recognition.start();
                }
            });

            recognition.onstart = () => {
                isListening = true;
                micBtn.classList.add('listening');
                micBtn.innerHTML = '<i class="fas fa-stop"></i>';
                logToTerminal('Voice recognition started.');
            };

            recognition.onend = () => {
                isListening = false;
                micBtn.classList.remove('listening');
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
                 logToTerminal('Voice recognition ended.');
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                input.value = transcript;
                // Automatically submit the form
                form.dispatchEvent(new Event('submit', { cancelable: true }));
            };
            
            recognition.onerror = (event: any) => {
                logToTerminal(`Voice recognition error: ${event.error}`, 'error');
                showToast(`Voice Error: ${event.error}`, 'error');
            };

        } else {
            micBtn.disabled = true;
            showToast('Speech recognition not supported by this browser.', 'warning');
        }


        form.onsubmit = async (e) => {
            e.preventDefault();
            const userMessage = input.value.trim();
            if (!userMessage) return;

            // Display user message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'user-message';
            userMessageDiv.textContent = userMessage;
            messagesContainer.appendChild(userMessageDiv);

            input.value = '';
            input.disabled = true;
            submitButton.disabled = true;
            micBtn.disabled = true;
            
            // Display thinking indicator
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'ai-message thinking';
            thinkingDiv.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div>`;
            messagesContainer.appendChild(thinkingDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                const response = await aiChat.sendMessage({ message: userMessage });
                
                thinkingDiv.remove(); // Remove thinking indicator
                
                const aiMessageDiv = document.createElement('div');
                aiMessageDiv.className = 'ai-message';
                const messageTextSpan = document.createElement('span');
                messageTextSpan.className = 'ai-message-text';
                messageTextSpan.textContent = response.text;
                aiMessageDiv.appendChild(messageTextSpan);
                messagesContainer.appendChild(aiMessageDiv);
                
                speak(response.text, aiMessageDiv);

            } catch (error) {
                console.error("AI chat error:", error);
                thinkingDiv.remove();
                const errorDiv = document.createElement('div');
                errorDiv.className = 'ai-message';
                errorDiv.style.color = 'var(--error)';
                errorDiv.innerHTML = `<span class="ai-message-text">Sorry, I encountered an error. Please try again.</span>`;
                messagesContainer.appendChild(errorDiv);
                logToTerminal('AI chat error.', 'error');
            } finally {
                input.disabled = false;
                submitButton.disabled = false;
                if(recognition) micBtn.disabled = false;
                input.focus();
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
    }

    function setupSentinelProtocol(sentinelElement: HTMLElement) {
        const tabs = sentinelElement.querySelectorAll('.sentinel-tab');
        const contents = sentinelElement.querySelectorAll('.sentinel-tab-content');

        // Tab switching logic
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                contents.forEach(content => {
                    if (content.getAttribute('data-tab-content') === targetTab) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });
        
        // Sentiment Analysis Module
        const scoreEl = sentinelElement.querySelector('.sentiment-score') as HTMLElement;
        const labelEl = sentinelElement.querySelector('.sentiment-label') as HTMLElement;
        const needleEl = sentinelElement.querySelector('.gauge-needle') as HTMLElement;
        const driversListEl = sentinelElement.querySelector('.drivers-list') as HTMLUListElement;

        let currentScore = 72; // Initial score
        
        const positiveDrivers = [
            "Major exchange lists SNTL.",
            "Positive regulatory news emerges.",
            "Partnership with top DeFi protocol announced.",
            "Staking rewards program proves popular.",
            "Whale accumulation detected on-chain."
        ];
        const negativeDrivers = [
            "Key developer departs from project.",
            "Exploit found in a related protocol.",
            "General market downturn affects all assets.",
            "Regulatory uncertainty concerns investors.",
            "Social media sentiment turns negative."
        ];

        function updateSentiment() {
            // Simulate score fluctuation
            const change = Math.floor(Math.random() * 11) - 5; // -5 to +5
            currentScore = Math.max(0, Math.min(100, currentScore + change));
            
            // Update score and label
            if (!scoreEl || !labelEl || !needleEl || !driversListEl) return;

            scoreEl.textContent = String(currentScore);
            
            let label = 'Neutral';
            let labelClass = 'neutral';
            if (currentScore > 75) {
                label = 'Extreme Greed';
                labelClass = 'greed';
            } else if (currentScore > 55) {
                label = 'Greed';
                labelClass = 'greed';
            } else if (currentScore < 25) {
                label = 'Extreme Fear';
                labelClass = 'fear';
            } else if (currentScore < 45) {
                label = 'Fear';
                labelClass = 'fear';
            }
            labelEl.textContent = label;
            labelEl.className = `sentiment-label ${labelClass}`;

            // Update gauge needle rotation
            // The gauge is a semicircle, -90deg is 0, +90deg is 100.
            const rotation = (currentScore / 100) * 180 - 90;
            needleEl.style.transform = `rotate(${rotation}deg)`;
            
            // Update drivers
            driversListEl.innerHTML = '';
            const driver1 = positiveDrivers[Math.floor(Math.random() * positiveDrivers.length)];
            const driver2 = negativeDrivers[Math.floor(Math.random() * negativeDrivers.length)];
            const drivers = Math.random() > 0.5 ? [driver1, driver2] : [driver2, driver1]; // shuffle
            
            if (currentScore > 60) {
                drivers.push(positiveDrivers[Math.floor(Math.random() * positiveDrivers.length)]);
            } else if (currentScore < 40) {
                drivers.push(negativeDrivers[Math.floor(Math.random() * negativeDrivers.length)]);
            }

            // Show 2 random drivers
            const selectedDrivers = drivers.sort(() => 0.5 - Math.random()).slice(0, 2);

            selectedDrivers.forEach(d => {
                const isPositive = positiveDrivers.includes(d);
                const li = document.createElement('li');
                li.innerHTML = `<i class="fas ${isPositive ? 'fa-arrow-up' : 'fa-arrow-down'}"></i> ${d}`;
                li.classList.add(isPositive ? 'positive' : 'negative');
                driversListEl.appendChild(li);
            });
        }
        
        updateSentiment(); // Initial call
        const sentimentInterval = setInterval(updateSentiment, 4000);
        
        // Note: A robust implementation would clear this interval when the component is removed.
    }

    function initializeAdminControls() {
        if (!adminControlsModal || !openAdminControlsBtn || !closeAdminControlsBtn) return;

        const btcPriceEl = document.getElementById('admin-btc-price') as HTMLElement;
        const btcChangeEl = document.getElementById('admin-btc-change') as HTMLElement;
        const btcVolumeEl = document.getElementById('admin-btc-volume') as HTMLElement;
        const sentimentEl = document.getElementById('admin-sentiment') as HTMLElement;
        const newsItemEl = document.getElementById('admin-news-item') as HTMLElement;
        const directiveOutput = document.getElementById('admin-directive-output') as HTMLElement;
        const synthesizeBtn = document.getElementById('admin-synthesize-btn') as HTMLButtonElement;
        const benchmarkSlider = document.getElementById('admin-benchmark-slider') as HTMLInputElement;
        const benchmarkValue = document.getElementById('admin-benchmark-value') as HTMLElement;
        
        let marketDataInterval: number | null = null;
        
        const newsHeadlines = [
            { text: "FED CHAIR HINTS AT STABLE RATES, BOOSTING MARKET CONFIDENCE", sentiment: 'positive' },
            { text: "MAJOR EXCHANGE REPORTS SECURITY BREACH, MARKET JITTERS EVIDENT", sentiment: 'negative' },
            { text: "ETF INFLOWS REACH RECORD HIGHS, INSTITUTIONAL ADOPTION SURGES", sentiment: 'positive' },
            { text: "REGULATORY UNCERTAINTY IN ASIA CAUSES REGIONAL SELL-OFF", sentiment: 'negative' },
            { text: "BITCOIN HASH RATE HITS NEW ALL-TIME HIGH, NETWORK SECURE", sentiment: 'positive' }
        ];

        let marketState = {
            price: 68521.44,
            change: 2.15,
            volume: 45.2,
            sentiment: 72,
            sentimentText: 'Greed',
            news: newsHeadlines[0].text,
            benchmarkPrivacy: 50,
            benchmarkSecurity: 50,
        };

        function updateMarketData() {
            // Simulate fluctuations
            marketState.price *= (1 + (Math.random() - 0.5) * 0.01);
            marketState.change += (Math.random() - 0.5) * 0.5;
            marketState.volume += (Math.random() - 0.5) * 0.5;
            marketState.sentiment = Math.max(10, Math.min(90, marketState.sentiment + Math.floor((Math.random() - 0.5) * 4)));

            if (Math.random() < 0.2) { // 20% chance to update news
                const randomNews = newsHeadlines[Math.floor(Math.random() * newsHeadlines.length)];
                marketState.news = randomNews.text;
                if (randomNews.sentiment === 'positive') marketState.sentiment += 5;
                if (randomNews.sentiment === 'negative') marketState.sentiment -= 5;
            }
            
            marketState.sentimentText = marketState.sentiment > 75 ? 'Extreme Greed' : marketState.sentiment > 55 ? 'Greed' : marketState.sentiment < 25 ? 'Extreme Fear' : marketState.sentiment < 45 ? 'Fear' : 'Neutral';

            // Update DOM
            btcPriceEl.textContent = `$${marketState.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            btcChangeEl.textContent = `${marketState.change >= 0 ? '+' : ''}${marketState.change.toFixed(2)}%`;
            btcChangeEl.className = marketState.change >= 0 ? 'positive' : 'negative';
            btcVolumeEl.textContent = `$${marketState.volume.toFixed(1)}B`;
            sentimentEl.textContent = `${marketState.sentiment} (${marketState.sentimentText})`;
            sentimentEl.className = marketState.sentiment >= 50 ? 'positive' : 'negative';
            newsItemEl.textContent = marketState.news;
        }
        
        openAdminControlsBtn.addEventListener('click', () => {
            adminControlsModal.style.display = 'flex';
            if (!marketDataInterval) {
                updateMarketData(); // run once immediately
                marketDataInterval = window.setInterval(updateMarketData, 3000);
            }
        });

        closeAdminControlsBtn.addEventListener('click', () => {
            adminControlsModal.style.display = 'none';
            if (marketDataInterval) {
                clearInterval(marketDataInterval);
                marketDataInterval = null;
            }
        });

        benchmarkSlider.addEventListener('input', () => {
            const securityValue = parseInt(benchmarkSlider.value, 10);
            const privacyValue = 100 - securityValue;
            
            marketState.benchmarkPrivacy = privacyValue;
            marketState.benchmarkSecurity = securityValue;
            
            benchmarkValue.textContent = `Privacy ${privacyValue}% / Security ${securityValue}%`;
            logToTerminal(`Benchmark quota adjusted: Privacy ${privacyValue}%, Security ${securityValue}%.`);
        });

        synthesizeBtn.addEventListener('click', async () => {
            if (!ai) {
                showToast('AI Core is offline. Check API Key.', 'error');
                return;
            }
            
            synthesizeBtn.disabled = true;
            synthesizeBtn.textContent = "SYNTHESIZING...";
            directiveOutput.classList.remove('placeholder');
            directiveOutput.innerHTML = '';
            
            let fullResponse = '';
            const cursorSpan = '<span class="cursor"></span>';

            try {
                const prompt = `
You are the AI core of a DEX trading bot named AI-BITBOY. Analyze the following market data and provide a concise, actionable trade directive. Present the output in a structured, professional format with sections for ANALYSIS, STRATEGIC CONCLUSION, and ACTIONABLE DIRECTIVE. Be decisive and use a confident, technical tone.

Market Data:
- BTC/USD Price: $${marketState.price.toFixed(2)}
- 24h Momentum: ${marketState.change.toFixed(2)}%
- Market Sentiment: ${marketState.sentiment} (${marketState.sentimentText})
- Key Headline: "${marketState.news}"
- System Benchmark Quota: Privacy ${marketState.benchmarkPrivacy}% / Security ${marketState.benchmarkSecurity}%
`;

                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                });
                
                for await (const chunk of responseStream) {
                    const chunkText = chunk.text;
                    fullResponse += chunkText;
                    directiveOutput.innerHTML = fullResponse.replace(/\n/g, '<br>') + cursorSpan;
                }
                directiveOutput.innerHTML = fullResponse.replace(/\n/g, '<br>');

            } catch (error) {
                console.error("AI Synthesis Error:", error);
                directiveOutput.innerHTML = '<span style="color: var(--admin-text-red);">Error: AI Synthesis Failed. Check terminal for details.</span>';
                logToTerminal('AI Synthesis error.', 'error');
            } finally {
                synthesizeBtn.disabled = false;
                synthesizeBtn.textContent = "RE-SYNTHESIZE DIRECTIVE";
            }
        });
    }

    function initializeAIGenesis() {
        const promptTextarea = document.getElementById('ai-genesis-prompt') as HTMLTextAreaElement;
        const generateBtn = document.getElementById('ai-genesis-generate-btn') as HTMLButtonElement;
        const outputContainer = document.getElementById('ai-genesis-output-container') as HTMLElement;
        const codeOutput = document.getElementById('ai-genesis-code') as HTMLElement;
        const copyBtn = document.getElementById('ai-genesis-copy-btn') as HTMLButtonElement;
        const addBtn = document.getElementById('ai-genesis-add-btn') as HTMLButtonElement;

        generateBtn.addEventListener('click', async () => {
            const userPrompt = promptTextarea.value.trim();
            if (!userPrompt) {
                showToast('Please describe the component you want to build.', 'warning');
                return;
            }
            if (!ai) {
                showToast('AI Genesis is offline. Check API Key.', 'error');
                return;
            }

            generateBtn.disabled = true;
            generateBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Generating...`;
            outputContainer.style.display = 'none';
            codeOutput.textContent = '';
            logToTerminal(`Generating component for prompt: "${userPrompt}"`);

            const fullPrompt = `
You are an expert frontend developer specializing in creating self-contained Web3 UI components using HTML, CSS, and JavaScript. Your task is to generate a single, complete HTML code block based on the user's request. The component must be fully functional and styled within this single snippet.

**Requirements:**
1.  **Single HTML Block:** The entire output must be a single block of HTML code. Do not provide explanations or wrapper text.
2.  **Styling:** All CSS must be included within a <style> tag inside the HTML. Design for a modern, dark-themed application. Use placeholder colors like '#0f172a' (dark blue), '#f78d60' (orange), '#6e8efb' (light blue), and '#f8fafc' (light text) where appropriate. The component should be wrapped in a root container with class "app-component" and "generated-component".
3.  **JavaScript:** All JavaScript logic must be included within a <script> tag at the end of the HTML. Do not use external scripts. Use vanilla JavaScript.
4.  **Icons:** Use Font Awesome icons (e.g., <i class="fas fa-wallet"></i>) where appropriate, as Font Awesome is available.

**User Request:** "${userPrompt}"

Generate only the raw HTML code block. Do not use markdown backticks.`;

            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: fullPrompt
                });
                
                let generatedCode = response.text;
                // Clean up potential markdown backticks just in case
                generatedCode = generatedCode.replace(/^```html\n?/, '').replace(/\n?```$/, '');

                codeOutput.textContent = generatedCode;
                outputContainer.style.display = 'flex';
                logToTerminal('Component generated successfully.', 'success');
            } catch (error) {
                console.error("AI Genesis Error:", error);
                logToTerminal('AI component generation failed.', 'error');
                showToast('Failed to generate component.', 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = `<i class="fas fa-bolt"></i> Generate`;
            }
        });

        copyBtn.addEventListener('click', () => {
            if (codeOutput.textContent) {
                navigator.clipboard.writeText(codeOutput.textContent);
                showToast('Code copied to clipboard!', 'success');
            }
        });

        addBtn.addEventListener('click', () => {
            const code = codeOutput.textContent;
            if (code) {
                if (previewPlaceholder) {
                    previewPlaceholder.style.display = 'none';
                }
                previewArea.insertAdjacentHTML('beforeend', code);
                logToTerminal('AI-generated component added to preview.');
                showToast('Component added to preview area!', 'success');
            }
        });
    }


    // --- Event Listeners ---

    // Wallet connection
    connectBtn.addEventListener('click', () => connectModal.style.display = 'flex');
    closeModalBtn.addEventListener('click', () => connectModal.style.display = 'none');
    disconnectBtn.addEventListener('click', disconnectWallet);
    document.getElementById('connect-metamask-btn')?.addEventListener('click', connectWallet);
    document.getElementById('connect-walletconnect-btn')?.addEventListener('click', connectWallet);
    document.getElementById('connect-cli-btn')?.addEventListener('click', connectWallet);
    
    // Component Drag and Drop
    components.forEach(component => {
        component.addEventListener('dragstart', (e: DragEvent) => {
            (e.target as HTMLElement).classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', (e.target as HTMLElement).dataset.type || '');
            }
        });

        component.addEventListener('dragend', (e: DragEvent) => {
            (e.target as HTMLElement).classList.remove('dragging');
        });
    });

    previewArea.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        previewArea.classList.add('drag-over');
    });

    previewArea.addEventListener('dragleave', (e: DragEvent) => {
        previewArea.classList.remove('drag-over');
    });

    previewArea.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        previewArea.classList.remove('drag-over');
        if (e.dataTransfer) {
            const type = e.dataTransfer.getData('text/plain');
            addComponentToPreview(type, e.clientX, e.clientY);
        }
    });
    
    // Element selection and properties
    previewArea.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editableElement = target.closest('[data-editable-part]') as HTMLElement;
        const componentElement = target.closest('.app-component') as HTMLElement;

        if (editableElement) {
             selectElement(editableElement);
        } else if (componentElement) {
            selectElement(componentElement);
        }
    });

    propertiesEditor.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.id === 'title-text') {
            updateElementStyle('textContent', target.value);
        } else if (target.id === 'bg-color') {
            updateElementStyle('backgroundColor', target.value);
        } else if (target.id === 'border-radius') {
            updateElementStyle('borderRadius', target.value);
        } else if (target.id === 'button-text') {
            updateElementStyle('textContent', target.value);
        }
    });

    // Control buttons
    resetBtn.addEventListener('click', resetPreview);

    // --- Context Menu Logic ---
    function hideContextMenu() {
        contextMenu.style.display = 'none';
        contextElement = null;
    }
    
    previewArea.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const targetComponent = (e.target as HTMLElement).closest('.app-component');
        if (!targetComponent) {
            hideContextMenu();
            return;
        };

        contextElement = targetComponent as HTMLElement;
        
        const isDexModule = contextElement.classList.contains('dex-module');
        const duplicateOption = contextMenu.querySelector('[data-action="duplicate"]') as HTMLElement;
        const deleteOption = contextMenu.querySelector('[data-action="delete"]') as HTMLElement;
        
        if (isDexModule) {
            duplicateOption.classList.add('disabled');
            deleteOption.classList.add('disabled');
        } else {
            duplicateOption.classList.remove('disabled');
            deleteOption.classList.remove('disabled');
        }

        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';
    });

    contextMenu.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const actionItem = target.closest('li[data-action]');
        if (!actionItem || actionItem.classList.contains('disabled')) return;

        const action = actionItem.getAttribute('data-action');

        if (contextElement) {
            switch (action) {
                case 'duplicate':
                    const type = contextElement.dataset.type;
                    if (type) {
                        const rect = contextElement.getBoundingClientRect();
                        addComponentToPreview(type, rect.left + 20, rect.top + 20);
                        logToTerminal(`Component duplicated: ${type}`);
                    }
                    break;
                case 'delete':
                    contextElement.remove();
                    logToTerminal(`Component removed.`);
                    if (previewArea.querySelectorAll('.app-component:not(.dex-module)').length === 0) {
                        if (previewPlaceholder) {
                            previewPlaceholder.style.display = 'flex';
                        }
                    }
                    break;
                case 'edit':
                    selectElement(contextElement);
                    break;
            }
        }
        hideContextMenu();
    });

    window.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target as Node)) {
            hideContextMenu();
        }
    });

    // --- Initialization ---
    logToTerminal('DEX Builder initialized.');
    updateSwapButton();
    initializeAdminControls();
    initializeAIGenesis();
});
