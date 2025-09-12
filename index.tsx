import { GoogleGenAI, Chat } from "@google/genai";

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const connectModal = document.getElementById('connect-modal') as HTMLElement;
    const connectBtn = document.getElementById('header-connect-btn') as HTMLElement;
    const disconnectBtn = document.getElementById('header-disconnect-btn') as HTMLElement;
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
    const contextMenu = document.getElementById('component-context-menu') as HTMLElement;
    const autoLayoutToolbar = document.getElementById('auto-layout-toolbar') as HTMLElement;

    // State
    let isWalletConnected = false;
    let selectedElement: HTMLElement | null = null;
    let contextElement: HTMLElement | null = null;
    let aiChat: Chat | null = null;
    let layoutSelection: HTMLElement[] = [];

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

    function disconnectWallet() {
        logToTerminal('Disconnecting wallet...');
        isWalletConnected = false;
        walletInfo.style.display = 'none';
        connectBtn.style.display = 'flex';
        disconnectBtn.style.display = 'none';
        walletStatus.classList.remove('connected');
        walletStatus.classList.add('disconnected');

        const cliComponentStatus = document.getElementById('cli-component-status');
        const cliComponentConnectBtn = document.getElementById('cli-component-connect-btn') as HTMLButtonElement;
        
        if (cliComponentStatus) {
            cliComponentStatus.innerHTML = `Status: <span>Disconnected</span>`;
            cliComponentStatus.classList.remove('connected');
        }

        if (cliComponentConnectBtn) {
            cliComponentConnectBtn.textContent = 'Connect to CLI';
            cliComponentConnectBtn.removeEventListener('click', disconnectWallet);
            cliComponentConnectBtn.addEventListener('click', connectWallet);
        }

        const swapButton = document.querySelector('.swap-button') as HTMLButtonElement;
        if(swapButton) swapButton.textContent = 'Connect Wallet';

        logToTerminal('Wallet disconnected.', 'info');
        showToast('Wallet disconnected.', 'success');
    }

    async function connectWallet() {
        logToTerminal('Attempting wallet connection...');
        if(connectModal) connectModal.style.display = 'none'; // Close modal immediately for better UX
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
            
            // Update Wallet CLI component
            const cliComponentStatus = document.getElementById('cli-component-status');
            const cliComponentConnectBtn = document.getElementById('cli-component-connect-btn') as HTMLButtonElement;
            if (cliComponentStatus) {
                cliComponentStatus.innerHTML = `Status: <span style="color: var(--success)">Connected</span>`;
                cliComponentStatus.classList.add('connected');
            }
            if (cliComponentConnectBtn) {
                cliComponentConnectBtn.textContent = 'Disconnect';
                cliComponentConnectBtn.removeEventListener('click', connectWallet);
                cliComponentConnectBtn.addEventListener('click', disconnectWallet);
            }

            // Update DEX module button
            const swapButton = document.querySelector('.swap-button') as HTMLButtonElement;
            if (swapButton) swapButton.textContent = 'Swap';


            logToTerminal(`Wallet connected successfully: ${walletData.address}`, 'success');
            showToast('Wallet connected!', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'An unknown error occurred.';
            logToTerminal(`Connection failed: ${message}`, 'error');
            showToast('Connection failed.', 'error');
        }
    }

    // --- Component Resizing Logic ---
    let resizeTarget: HTMLElement | null = null;
    let startX = 0, startY = 0, startWidth = 0, startHeight = 0;

    function onResizeStart(e: MouseEvent) {
        const handle = e.target as HTMLElement;
        if (!handle.classList.contains('resize-handle')) return;

        e.preventDefault();
        e.stopPropagation();

        resizeTarget = handle.parentElement;
        if (!resizeTarget) return;

        document.body.classList.add('resizing');
        const rect = resizeTarget.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;

        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', onResizeEnd, { once: true });
    }

    function onResize(e: MouseEvent) {
        if (!resizeTarget) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newWidth = Math.max(280, startWidth + dx);
        const newHeight = Math.max(150, startHeight + dy);
        resizeTarget.style.width = `${newWidth}px`;
        resizeTarget.style.height = `${newHeight}px`;
    }

    function onResizeEnd() {
        document.body.classList.remove('resizing');
        resizeTarget = null;
        document.removeEventListener('mousemove', onResize);
    }

    function addResizeHandle(element: HTMLElement) {
        if (element.classList.contains('app-component') && !element.querySelector('.resize-handle')) {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            element.appendChild(handle);
        }
    }

    // --- Auto Layout Logic ---
    function updateLayoutToolbar() {
        if (layoutSelection.length > 1) {
            autoLayoutToolbar.style.display = 'flex';
        } else {
            autoLayoutToolbar.style.display = 'none';
        }
    }

    function clearLayoutSelection() {
        layoutSelection.forEach(el => el.classList.remove('selected-for-layout'));
        layoutSelection = [];
        updateLayoutToolbar();
    }

    function toggleLayoutSelection(element: HTMLElement) {
        const index = layoutSelection.indexOf(element);
        if (index > -1) {
            layoutSelection.splice(index, 1);
            element.classList.remove('selected-for-layout');
        } else {
            layoutSelection.push(element);
            element.classList.add('selected-for-layout');
        }
        updateLayoutToolbar();
    }
    
    function applyLayout(type: 'row' | 'column' | 'grid') {
        if (layoutSelection.length < 2) return;

        logToTerminal(`Applying ${type} layout to ${layoutSelection.length} components.`);

        const groupWrapper = document.createElement('div');
        groupWrapper.classList.add('app-component', 'layout-group');
        groupWrapper.dataset.type = `layout-${type}`;
        
        if (type === 'grid') {
            groupWrapper.style.display = 'grid';
            const columns = Math.ceil(Math.sqrt(layoutSelection.length));
            groupWrapper.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        } else {
            groupWrapper.style.display = 'flex';
            groupWrapper.style.flexDirection = type;
        }

        const sortedSelection = layoutSelection.sort((a, b) => {
            const posA = a.compareDocumentPosition(b);
            if (posA & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
            if (posA & Node.DOCUMENT_POSITION_PRECEDING) return 1;
            return 0;
        });

        const firstElement = sortedSelection[0];
        if (firstElement.parentElement) {
            firstElement.parentElement.insertBefore(groupWrapper, firstElement);
        }

        sortedSelection.forEach(el => {
            el.classList.remove('selected-for-layout', 'selected');
            el.style.width = ''; 
            el.style.height = '';
            groupWrapper.appendChild(el);
        });

        clearLayoutSelection();
    }

    // Watch for new components being added to the preview area
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node instanceof HTMLElement) {
                    if (node.matches('.app-component')) {
                        addResizeHandle(node);
                    }
                    node.querySelectorAll<HTMLElement>('.app-component').forEach(addResizeHandle);
                }
            });
        });
    });

    observer.observe(previewArea, { childList: true, subtree: true });

    // --- Event Listeners ---
    previewArea.addEventListener('mousedown', onResizeStart);
    
    previewArea.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const component = target.closest('.app-component');

        if (!component) {
            clearLayoutSelection();
            if (selectedElement) {
                selectedElement.classList.remove('selected');
                selectedElement = null;
                propertiesEditor.innerHTML = '<p class="properties-placeholder">Select a DEX element to edit its properties.</p>';
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            if (selectedElement === component) {
                 selectedElement.classList.remove('selected');
                 selectedElement = null;
                 propertiesEditor.innerHTML = '<p class="properties-placeholder">Select a DEX element to edit its properties.</p>';
            }
            toggleLayoutSelection(component as HTMLElement);
        } else {
            clearLayoutSelection();
            
            if (selectedElement) {
                selectedElement.classList.remove('selected');
            }
            selectedElement = component as HTMLElement;
            selectedElement.classList.add('selected');
            // Placeholder for updating properties editor
            propertiesEditor.innerHTML = `<p class="properties-placeholder">Editing properties for ${selectedElement.dataset.type || 'component'}</p>`;
        }
    });

    autoLayoutToolbar.addEventListener('click', (e) => {
        const button = (e.target as HTMLElement).closest('button');
        if (!button) return;
        const layoutType = button.dataset.layout as 'row' | 'column' | 'grid';
        if (layoutType) {
            applyLayout(layoutType);
        }
    });

    connectBtn.addEventListener('click', () => {
      connectModal.style.display = 'flex';
    });
    
    disconnectBtn.addEventListener('click', disconnectWallet);

    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            const modal = (button as HTMLElement).closest('.modal');
            if (modal) {
                (modal as HTMLElement).style.display = 'none';
            }
        });
    });

    const cliConnectBtn = document.getElementById('connect-cli-btn');
    if (cliConnectBtn) {
      cliConnectBtn.addEventListener('click', connectWallet);
    }

    const cliComponentConnectBtn = document.getElementById('cli-component-connect-btn');
    if (cliComponentConnectBtn) {
        cliComponentConnectBtn.addEventListener('click', connectWallet);
    }
    
    openAdminControlsBtn.addEventListener('click', () => {
        adminControlsModal.style.display = 'flex';
    });
    
    resetBtn.addEventListener('click', () => {
        const componentsToRemove = previewArea.querySelectorAll('.app-component:not(#dex-main-module)');
        componentsToRemove.forEach(el => el.remove());
        logToTerminal('Canvas has been reset.', 'info');
        showToast('Canvas Reset', 'success');
        if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
    });
});