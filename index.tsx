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
    const exportBtn = document.getElementById('export-btn') as HTMLElement;
    const previewBtn = document.getElementById('preview-btn') as HTMLElement;
    const propertiesEditor = document.getElementById('properties-editor') as HTMLElement;
    const dexModule = document.getElementById('dex-main-module') as HTMLElement;

    // State
    let walletConnected: boolean = false;
    let walletAddress: string | null = null;
    let selectedPart: HTMLElement | null = null;
    let componentIdCounter = 0;
    let tokenBalances: { [key: string]: number } = {};

    const tokenData = {
        'ETH': { name: 'Ethereum', icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', price: 1800 },
        'USDC': { name: 'USD Coin', icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png', price: 1 },
        'LINK': { name: 'Chainlink', icon: 'https://cryptologos.cc/logos/chainlink-link-logo.png', price: 28.17 }
    };
    
    type ToastType = 'info' | 'success' | 'warning' | 'error';
    type TransactionType = 'swap' | 'wallet' | 'deposit' | 'withdrawal';
    interface Transaction {
        type: TransactionType;
        message: string;
        details?: {
            fromToken?: string;
            fromAmount?: number;
            toToken?: string;
            toAmount?: number;
        }
    }

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

    // Log to transactions panel
    function logTransaction(tx: Transaction) {
        const allTransactionLists = document.querySelectorAll('.transactions-list-container');
    
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.classList.add(`tx-type-${tx.type}`);
    
        let iconClass = 'fa-question-circle';
        switch (tx.type) {
            case 'swap': iconClass = 'fa-exchange-alt'; break;
            case 'wallet': iconClass = 'fa-wallet'; break;
            case 'deposit': iconClass = 'fa-arrow-down'; break;
            case 'withdrawal': iconClass = 'fa-arrow-up'; break;
        }
    
        let detailsHtml = '';
        if (tx.type === 'swap' && tx.details) {
            detailsHtml = `
                <div class="tx-amounts">
                    <span class="tx-amount-from">- ${tx.details.fromAmount?.toFixed(4)} ${tx.details.fromToken}</span>
                    <i class="fas fa-long-arrow-alt-right tx-separator"></i>
                    <span class="tx-amount-to">+ ${tx.details.toAmount?.toFixed(4)} ${tx.details.toToken}</span>
                </div>
            `;
        }
    
        const status = 'Confirmed';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
        item.innerHTML = `
            <div class="tx-icon"><i class="fas ${iconClass}"></i></div>
            <div class="tx-details">
                <p>${tx.message}</p>
                ${detailsHtml}
                <small>${status} - ${time}</small>
            </div>
        `;
    
        allTransactionLists.forEach(list => {
            const placeholder = list.querySelector('.transactions-placeholder');
            if (placeholder) {
                placeholder.remove();
            }
            list.prepend(item.cloneNode(true));
        });
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
        
        tokenBalances = { 'ETH': 2.5, 'USDC': 1500, 'LINK': 85.2 };

        walletInfo.style.display = 'flex';
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = 'block';
        (document.getElementById('header-wallet-address') as HTMLElement).textContent = walletAddress;
        walletStatus.classList.remove('disconnected');
        walletStatus.classList.add('connected', 'pulsing');
        (dexModule.querySelector('.swap-button') as HTMLElement).textContent = 'Swap';
        logToTerminal('Wallet connected successfully', 'success');
        logToTerminal(`Address: ${walletAddress}`, 'info');
        logTransaction({ type: 'wallet', message: `Wallet Connected: ${walletAddress.slice(0, 12)}...` });
        showToast('Wallet connected successfully', 'success');
        updateBalanceUI();
        updateWalletBalanceComponents();
    }
    
    function disconnectWallet() {
        walletConnected = false;
        walletAddress = null;
        tokenBalances = {};

        walletInfo.style.display = 'none';
        connectBtn.style.display = 'block';
        disconnectBtn.style.display = 'none';
        walletStatus.classList.remove('connected', 'pulsing');
        walletStatus.classList.add('disconnected');
        (dexModule.querySelector('.swap-button') as HTMLElement).textContent = 'Connect Wallet';
        logToTerminal('Wallet disconnected', 'warning');
        logTransaction({ type: 'wallet', message: 'Wallet Disconnected' });
        showToast('Wallet disconnected', 'warning');
        updateBalanceUI();
        updateWalletBalanceComponents();
    }

    function updateBalanceUI() {
        const ethBalanceDisplay = document.getElementById('header-wallet-balance') as HTMLElement;
        const payBalanceDisplay = dexModule.querySelector('.token-input-group:first-of-type .token-input-header span') as HTMLElement;
        const receiveBalanceDisplay = dexModule.querySelector('.token-input-group:last-of-type .token-input-header span') as HTMLElement;
        
        if (walletConnected) {
            const payToken = dexModule.querySelector('.token-input-group:first-of-type .token-selector span')?.textContent || 'ETH';
            const receiveToken = dexModule.querySelector('.token-input-group:last-of-type .token-selector span')?.textContent || 'USDC';

            ethBalanceDisplay.textContent = `${tokenBalances['ETH']?.toFixed(4) || '0.0000'} ETH`;
            payBalanceDisplay.textContent = `Balance: ${tokenBalances[payToken]?.toFixed(2) || '0.00'}`;
            receiveBalanceDisplay.textContent = `Balance: ${tokenBalances[receiveToken]?.toFixed(2) || '0.00'}`;
        } else {
            ethBalanceDisplay.textContent = '0.00 ETH';
            payBalanceDisplay.textContent = 'Balance: --';
            receiveBalanceDisplay.textContent = 'Balance: --';
        }
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
            e.stopPropagation();
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
            case 'app-component':
                const title = part.querySelector('h3')?.textContent?.trim() || 'Component';
                propertiesHtml = `<p class="properties-placeholder">No editable properties for the <strong>${title}</strong> component at this time.</p>`;
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
        logToTerminal('DEX state reset', 'info');
        showToast('DEX reset to default', 'info');
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

    // Swap Button Action
    const swapBtn = dexModule.querySelector('.swap-button') as HTMLElement;
    swapBtn.addEventListener('click', () => {
        if (!walletConnected) {
            showToast('Please connect your wallet first.', 'warning');
            connectBtn.click();
            return;
        }

        (swapBtn as HTMLButtonElement).disabled = true;
        swapBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Swapping...`;

        const restoreButton = () => {
            (swapBtn as HTMLButtonElement).disabled = false;
            swapBtn.textContent = 'Swap';
        };

        setTimeout(() => {
            const payInput = dexModule.querySelector('.token-input-group:first-of-type input') as HTMLInputElement;
            const receiveInput = dexModule.querySelector('.token-input-group:last-of-type input') as HTMLInputElement;
            const payToken = dexModule.querySelector('.token-input-group:first-of-type .token-selector span')?.textContent?.trim();
            const receiveToken = dexModule.querySelector('.token-input-group:last-of-type .token-selector span')?.textContent?.trim();
            
            const payAmount = parseFloat(payInput.value);
            const receiveAmount = parseFloat(receiveInput.value);
            
            if (isNaN(payAmount) || isNaN(receiveAmount) || payAmount <= 0) {
                showToast('Invalid swap amounts.', 'error');
                logToTerminal('Swap failed: Invalid amounts.', 'error');
                restoreButton();
                return;
            }

            if (!payToken || !receiveToken || !tokenBalances[payToken]) {
                showToast('Invalid token selection.', 'error');
                logToTerminal('Swap failed: Invalid tokens.', 'error');
                restoreButton();
                return;
            }
            
            if (tokenBalances[payToken] < payAmount) {
                showToast(`Insufficient ${payToken} balance.`, 'error');
                logToTerminal(`Swap failed: Insufficient ${payToken} balance.`, 'error');
                restoreButton();
                return;
            }
        
            setTimeout(() => {
                tokenBalances[payToken] -= payAmount;
                tokenBalances[receiveToken] = (tokenBalances[receiveToken] || 0) + receiveAmount;
                
                const message = `Swapped ${payToken} for ${receiveToken}`;
                logTransaction({
                    type: 'swap',
                    message: message,
                    details: {
                        fromToken: payToken,
                        fromAmount: payAmount,
                        toToken: receiveToken,
                        toAmount: receiveAmount
                    }
                });
                logToTerminal(`Swapped ${payAmount.toFixed(4)} ${payToken} for ${receiveAmount.toFixed(4)} ${receiveToken}`, 'success');
                showToast('Swap successful!', 'success');
                
                updateBalanceUI();
                updateWalletBalanceComponents();
                restoreButton();
            }, 1500);
        }, 50);
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
        componentIdCounter++;
        const componentId = `component-${type}-${componentIdCounter}`;
        
        const originalItem = document.querySelector(`.component-item[data-type="${type}"]`);
        if (!originalItem) return;

        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'none';
        }

        const titleText = originalItem.querySelector('h3')?.textContent || 'Component';
        
        if (type === 'tx-history') {
            const txHistoryComponent = document.createElement('div');
            txHistoryComponent.className = 'app-component tx-history-component';
            txHistoryComponent.dataset.type = type;
            txHistoryComponent.id = componentId;
            txHistoryComponent.dataset.editablePart = 'app-component';
            txHistoryComponent.innerHTML = `
                <h3><i class="fas fa-history"></i> Transaction History</h3>
                <div class="transactions-list-container">
                    <p class="transactions-placeholder">No transactions yet.</p>
                </div>
            `;
            previewArea.appendChild(txHistoryComponent);
            logToTerminal(`'${titleText}' component added to preview`, 'info');
            showToast(`Added ${titleText} component`, 'info');
            return;
        }

        if (type === 'wallet-balance') {
            const walletBalanceComponent = document.createElement('div');
            walletBalanceComponent.className = 'app-component wallet-balance-component';
            walletBalanceComponent.dataset.type = type;
            walletBalanceComponent.id = componentId;
            walletBalanceComponent.dataset.editablePart = 'app-component';
            previewArea.appendChild(walletBalanceComponent);
            updateWalletBalanceComponents(); // Set initial state
            logToTerminal(`'${titleText}' component added to preview`, 'info');
            showToast(`Added ${titleText} component`, 'info');
            return;
        }
        
        const iconHtml = originalItem.querySelector('.component-icon')?.innerHTML || '';
        const component = document.createElement('div');
        component.className = 'app-component';
        component.dataset.type = type;
        component.id = componentId;
        component.dataset.editablePart = 'app-component';
        
        component.innerHTML = `
            <h3>${iconHtml} ${titleText}</h3>
            <div class="component-content-placeholder">
                ${iconHtml}
                <p>Live content for the '${titleText}' component will appear here.</p>
            </div>
        `;
        
        previewArea.appendChild(component);
        logToTerminal(`'${titleText}' component added to preview`, 'info');
        showToast(`Added ${titleText} component`, 'info');
    }

    // Update Wallet Balance Components
    function updateWalletBalanceComponents() {
        const components = document.querySelectorAll('.wallet-balance-component');
        if (components.length === 0) return;

        let contentHtml = '';
        if (walletConnected) {
             contentHtml = Object.keys(tokenBalances).map(symbol => {
                const data = tokenData[symbol];
                if (!data) return '';
                const balance = tokenBalances[symbol];
                const value = (balance * data.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                
                return `
                    <div class="token-balance-item">
                        <img src="${data.icon}" alt="${data.name}" class="token-balance-icon">
                        <div class="token-balance-info">
                            <span class="token-balance-name">${data.name} (${symbol})</span>
                        </div>
                        <div class="token-balance-amount">
                            <span>${balance.toFixed(4)}</span>
                            <small>${value}</small>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            contentHtml = `
                <div class="wallet-balance-placeholder">
                    <i class="fas fa-plug"></i>
                    <p>Connect wallet to see your balances.</p>
                </div>
            `;
        }
        
        components.forEach((component: HTMLElement) => {
            component.innerHTML = `
                <h3><i class="fas fa-wallet"></i> My Wallet</h3>
                <div class="token-balance-list">
                    ${contentHtml}
                </div>
            `;
        });
    }

    // Parallax effect
    document.addEventListener('mousemove', (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        document.querySelectorAll('.parallax-layer').forEach((layer, index) => {
            (layer as HTMLElement).style.transform = `translateX(${x * (index + 1) * 0.5}px) translateY(${y * (index + 1) * 0.5}px)`;
        });
    });

    updateBalanceUI();
});