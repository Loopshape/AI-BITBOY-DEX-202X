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
    const resetBtn = document.getElementById('reset-btn') as HTMLElement;
    const exportBtn = document.getElementById('export-btn') as HTMLElement;
    const previewBtn = document.getElementById('preview-btn') as HTMLElement;
    const propertiesEditor = document.getElementById('properties-editor') as HTMLElement;
    const dexModule = document.getElementById('dex-main-module') as HTMLElement;

    // State
    let walletConnected: boolean = false;
    let walletAddress: string | null = null;
    let selectedPart: HTMLElement | null = null;
    
    type ToastType = 'info' | 'success' | 'warning' | 'error';

    // Toast notification system
    function showToast(message: string, type: ToastType = 'info') {
        const toastContainer = document.getElementById('toastContainer') as HTMLElement;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }, 5000);
    }
    
    // Log to terminal
    function logToTerminal(message: string, type: ToastType = 'info') {
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        const timestamp = new Date().toLocaleTimeString();
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> <span class="log-${type}">${message}</span>`;
        terminal.appendChild(logEntry);
        terminal.scrollTop = terminal.scrollHeight;
    }
    
    // Initial logs
    logToTerminal('DEX Builder initialized', 'info');
    logToTerminal('Web3 environment ready', 'success');
    logToTerminal('Wallet not connected', 'warning');
    
    // Modal functionality
    connectBtn.addEventListener('click', () => { connectModal.style.display = 'flex'; });
    closeModalBtn.addEventListener('click', () => { connectModal.style.display = 'none'; });
    window.addEventListener('click', (e: MouseEvent) => {
        if (e.target === connectModal) {
            connectModal.style.display = 'none';
        }
    });
    
    // Wallet connection handlers
    (document.getElementById('connect-metamask-btn') as HTMLElement).addEventListener('click', connectWallet);
    (document.getElementById('connect-walletconnect-btn') as HTMLElement).addEventListener('click', connectWallet);
    (document.getElementById('connect-cli-btn') as HTMLElement).addEventListener('click', connectWallet);
    disconnectBtn.addEventListener('click', disconnectWallet);
    
    function connectWallet() {
        connectModal.style.display = 'none';
        walletConnected = true;
        walletAddress = '0x' + Math.random().toString(16).slice(2, 10) + '...' + Math.random().toString(16).slice(2, 6);
        walletInfo.style.display = 'flex';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
        (document.getElementById('header-wallet-address') as HTMLElement).textContent = walletAddress;
        (document.getElementById('header-wallet-balance') as HTMLElement).textContent = (Math.random() * 2).toFixed(4) + ' ETH';
        walletStatus.classList.remove('disconnected');
        walletStatus.classList.add('connected', 'pulsing');
        (dexModule.querySelector('.swap-button') as HTMLElement).textContent = 'Swap';
        logToTerminal('Wallet connected successfully', 'success');
        logToTerminal(`Address: ${walletAddress}`, 'info');
        showToast('Wallet connected successfully', 'success');
    }
    
    function disconnectWallet() {
        walletConnected = false;
        walletAddress = null;
        walletInfo.style.display = 'none';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        walletStatus.classList.remove('connected', 'pulsing');
        walletStatus.classList.add('disconnected');
        (dexModule.querySelector('.swap-button') as HTMLElement).textContent = 'Connect Wallet';
        logToTerminal('Wallet disconnected', 'warning');
        showToast('Wallet disconnected', 'warning');
    }

    // DEX Component Selection
    function selectPart(part: HTMLElement) {
        if (selectedPart) {
            selectedPart.classList.remove('selected');
        }
        selectedPart = part;
        selectedPart.classList.add('selected');
        populateProperties(selectedPart);
    }

    function deselectPart() {
        if (selectedPart) {
            selectedPart.classList.remove('selected');
            selectedPart = null;
            propertiesEditor.innerHTML = `<p class="properties-placeholder">Select a DEX element to edit its properties.</p>`;
        }
    }
    
    previewArea.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const editablePart = target.closest('[data-editable-part]') as HTMLElement;

        if (editablePart) {
            selectPart(editablePart);
        } else if (target === previewArea || target.closest('.preview-panel')) {
            deselectPart();
        }
    });

    // Properties Editor
    function populateProperties(part: HTMLElement) {
        const partType = part.dataset.editablePart;
        let propertiesHtml = '';

        const createInput = (label: string, property: string, value: string, type: string = 'text') => `
            <div class="property-group">
                <label>${label}</label>
                <input type="${type}" data-property="${property}" value="${value}">
            </div>`;

        switch(partType) {
            case 'dex-title':
                propertiesHtml = createInput('Title Text', 'text', part.textContent || 'Swap Tokens');
                break;
            case 'dex-swap-box':
                propertiesHtml = createInput('Background Color', 'background', '#0f172a', 'color');
                break;
            case 'dex-swap-button':
                 propertiesHtml = `
                    ${createInput('Button Text', 'text', part.textContent || 'Swap')}
                    ${createInput('Background Color', 'background', '#f78d60', 'color')}
                 `;
                break;
            case 'dex-settings':
                propertiesHtml = `
                    <div class="property-group">
                        <label>Slippage Tolerance</label>
                        <select data-property="slippage">
                            <option value="0.1">0.1%</option>
                            <option value="0.5" selected>0.5%</option>
                            <option value="1.0">1.0%</option>
                        </select>
                    </div>
                `;
                break;
            default:
                propertiesHtml = `<p class="properties-placeholder">No editable properties for this element.</p>`;
        }
        propertiesEditor.innerHTML = propertiesHtml;
        addPropertyListeners();
    }

    function addPropertyListeners() {
        propertiesEditor.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', (e) => {
                if (!selectedPart) return;
                const target = e.target as HTMLInputElement | HTMLSelectElement;
                const property = target.dataset.property;
                const value = target.value;

                switch(property) {
                    case 'text':
                        selectedPart.textContent = value;
                        break;
                    case 'background':
                        selectedPart.style.backgroundColor = value;
                        break;
                    case 'slippage':
                        logToTerminal(`Slippage set to ${value}%`, 'info');
                        showToast(`Slippage tolerance updated to ${value}%`, 'info');
                        break;
                }
            });
        });
    }
    
    // Action Buttons
    resetBtn.addEventListener('click', function() {
        // This would reset the DEX to its original state. For simplicity, we just log it.
        logToTerminal('DEX state reset', 'info');
        showToast('DEX reset to default', 'info');
        // A full implementation would re-render the original component HTML or reset styles/text.
        window.location.reload();
    });
    
    exportBtn.addEventListener('click', function() {
        logToTerminal('Exporting DEX code...', 'info');
        setTimeout(() => {
            logToTerminal('DEX code exported successfully', 'success');
            showToast(`Exported DEX!`, 'success');
        }, 1000);
    });
    
    previewBtn.addEventListener('click', function() {
        logToTerminal('Launching DEX preview...', 'info');
        setTimeout(() => {
            logToTerminal('Preview launched successfully', 'success');
            showToast(`Launching preview...`, 'success');
        }, 1000);
    });
    
    // Drag and Drop Functionality
    const componentItems = document.querySelectorAll('.component-item') as NodeListOf<HTMLElement>;

    componentItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', item.dataset.type || '');
            }
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
        });
    });

    previewArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        previewArea.classList.add('drag-over');
    });

    previewArea.addEventListener('dragleave', () => {
        previewArea.classList.remove('drag-over');
    });

    previewArea.addEventListener('drop', (e) => {
        e.preventDefault();
        previewArea.classList.remove('drag-over');
        if (e.dataTransfer) {
            const componentType = e.dataTransfer.getData('text/plain');
            if (componentType) {
                addComponentToPreview(componentType);
            }
        }
    });

    function addComponentToPreview(type: string) {
        const originalItem = document.querySelector(`.component-item[data-type="${type}"]`);
        if (!originalItem) return;

        const iconHtml = originalItem.querySelector('.component-icon')?.innerHTML || '';
        const titleText = originalItem.querySelector('h3')?.textContent || 'Component';
        
        const placeholder = document.createElement('div');
        placeholder.className = 'app-component component-placeholder';
        placeholder.dataset.type = type;
        
        placeholder.innerHTML = `
            <div class="component-icon">${iconHtml}</div>
            <div>
                <h3>${titleText}</h3>
                <p>This component will be displayed here.</p>
            </div>
        `;
        
        previewArea.appendChild(placeholder);
        logToTerminal(`'${titleText}' component added to preview`, 'info');
        showToast(`Added ${titleText} component`, 'info');
    }

    // Parallax effect
    document.addEventListener('mousemove', (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        document.querySelectorAll('.parallax-layer').forEach((layer, index) => {
            (layer as HTMLElement).style.transform = `translateX(${x * (index + 1) * 0.5}px) translateY(${y * (index + 1) * 0.5}px)`;
        });
    });
});