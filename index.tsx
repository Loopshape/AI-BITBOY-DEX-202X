

import * as bip39 from 'bip39';
import { Web3Modal } from '@web3modal/standalone';
import { ethers } from 'https://esm.run/ethers';
import QRCode from 'qrcode';


// Declare VANTA to make it available in TypeScript
declare var VANTA: any;
// Declare TradingView for the widget
declare var TradingView: any;


// Extend Window interface for MetaMask/Web3 wallet compatibility
declare global {
  interface Window {
    ethereum?: any;
  }
}

// ===============================================
// VANTA.JS BACKGROUND
// ===============================================
VANTA.NET({
  el: "#vanta-canvas",
  mouseControls: true,
  touchControls: true,
  gyroControls: false,
  minHeight: 200.00,
  minWidth: 200.00,
  scale: 1.00,
  scaleMobile: 1.00,
  color: 0x00ffcc,
  backgroundColor: 0x0a1a2f,
  points: 10.00,
  maxDistance: 22.00,
  spacing: 18.00
});

// ===============================================
// GLOBAL CONSOLE LOGGER
// ===============================================
const consoleElement = document.getElementById('console') as HTMLElement;
function logToConsole(message: string, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span class="log-info">[${timestamp}]</span> <span class="log-${type}">${message}</span>`;
  logEntry.classList.add('fade-in');
  consoleElement.appendChild(logEntry);
  consoleElement.scrollTop = consoleElement.scrollHeight; // Auto-scroll
}

document.addEventListener('DOMContentLoaded', () => {

  const RECURRING_TASKS_KEY = 'bitboy_ai_dex_tasks';
  const KANBAN_TASKS_KEY = 'nemodian_kanban_tasks';
  const FROM_TOKEN_KEY = 'dex_from_token';
  const TO_TOKEN_KEY = 'dex_to_token';
  const LEVERAGE_KEY = 'dex_leverage';
  const AI_CHAT_HISTORY_KEY = 'bitboy_ai_dex_chat_history';
  const COINGECKO_API_KEY = 'coingecko_api_key';


  // ===============================================
  // UI & UX Enhancements
  // ===============================================
  
  // Parallax mouse effect
  const parallaxLayers = document.querySelectorAll('.parallax-layer');
  document.addEventListener('mousemove', (e) => {
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 40;
    const y = (clientY / window.innerHeight - 0.5) * 40;

    parallaxLayers.forEach((layer, index) => {
        const speed = (index + 1) * 0.5;
        (layer as HTMLElement).style.transform = `translateX(${x * speed}px) translateY(${y * speed}px)`;
    });
  });

  // Equalize card heights
  function equalizeCardHeights() {
      const cards = document.querySelectorAll('.grid > .stack .card') as NodeListOf<HTMLElement>;
      let maxHeight = 0;
      cards.forEach(card => {
          card.style.minHeight = 'auto'; // Reset height first
          if (card.offsetHeight > maxHeight) {
              maxHeight = card.offsetHeight;
          }
      });
      if (window.innerWidth >= 1024 && maxHeight > 0) {
        cards.forEach(card => card.style.minHeight = `${maxHeight}px`);
      }
  }
  window.addEventListener('load', equalizeCardHeights);
  window.addEventListener('resize', equalizeCardHeights);


  // Tabs
  function setupTabs() {
    const tabContainer = document.querySelector('#main-card');
    if (!tabContainer) return;
    
    const tabButtons = tabContainer.querySelectorAll('.tab-button');
    const tabContents = tabContainer.querySelectorAll('.tab-content');
    const prominentButtons = document.querySelectorAll('.prominent-btn');

    const switchTab = (targetId: string) => {
        tabContents.forEach(content => {
            content.classList.toggle('active', content.id === targetId);
        });
        tabButtons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === targetId);
        });
        equalizeCardHeights(); // Re-calculate card height on tab change
    };

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-tab');
        if (targetId) switchTab(targetId);
      });
    });

    prominentButtons.forEach(button => {
      button.addEventListener('click', () => {
          const targetId = button.getAttribute('data-tab-target');
          if (targetId) switchTab(targetId);
      });
    });
  }
  setupTabs();

  // Connect Modal
  const connectModal = document.getElementById('connect-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const headerConnectBtn = document.getElementById('header-connect-btn');
  
  const openModal = () => connectModal && (connectModal.style.display = 'flex');
  const closeModal = () => connectModal && (connectModal.style.display = 'none');
  
  if (headerConnectBtn) headerConnectBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  // QR Code Modal
  const qrModal = document.getElementById('qr-modal');
  const closeQrModalBtn = document.getElementById('close-qr-modal-btn');
  const showQrBtn = document.getElementById('show-qr-btn') as HTMLButtonElement;
  const qrCanvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
  const qrModalAddress = document.getElementById('qr-modal-address') as HTMLElement;

  const openQrModal = async () => {
      if (qrModal && walletAddress) {
          try {
              await QRCode.toCanvas(qrCanvas, walletAddress, {
                  width: 250,
                  margin: 2,
                  color: { dark: '#0a1a2f', light: '#ffffff' }
              });
              qrModalAddress.textContent = walletAddress;
              qrModal.style.display = 'flex';
          } catch (err) {
              logToConsole(`Failed to generate QR code: ${(err as Error).message}`, 'error');
          }
      }
  };
  const closeQrModal = () => qrModal && (qrModal.style.display = 'none');

  if (showQrBtn) showQrBtn.addEventListener('click', openQrModal);
  if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', closeQrModal);

  // ===============================================
  // WALLET CONNECTION (Web3Modal + Ethers.js)
  // ===============================================
  const projectId = 'e8093da4c2a4413b538f949f564ab1f3'; // Replace with your WalletConnect Cloud project ID

  const web3Modal = new Web3Modal({
      walletConnectProjectId: projectId,
      standaloneChains: ['eip155:1'],
      //... other options
  });

  let web3Provider: ethers.BrowserProvider | ethers.JsonRpcProvider | null = null;
  let walletAddress: string | null = null;

  // --- Wallet Event Handlers ---
  const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
          logToConsole('Wallet account changed. Updating...', 'info');
          const newProvider = web3Provider?.provider ? new ethers.BrowserProvider(web3Provider.provider) : null;
          if (newProvider) {
              updateWalletInfo(newProvider);
          }
      } else {
          logToConsole('Wallet disconnected all accounts.', 'info');
          disconnectWallet();
      }
  };

  const handleDisconnect = () => {
      logToConsole('Provider disconnected from chain.', 'warn');
      disconnectWallet();
  };

  function listenToProviderEvents(provider: any) {
    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('disconnect', handleDisconnect);
  }
  
  function removeProviderEvents(provider: any) {
    provider.removeListener('accountsChanged', handleAccountsChanged);
    provider.removeListener('disconnect', handleDisconnect);
  }

  async function connectWallet(connector: 'metaMask' | 'walletConnect' | 'cli') {
      closeModal();
      logToConsole(`Attempting connection with ${connector}...`, 'info');
      try {
          if (connector === 'metaMask') {
              if (!window.ethereum) {
                  logToConsole('MetaMask not detected. Please install the extension.', 'error');
                  return;
              }
              const provider = new ethers.BrowserProvider(window.ethereum);
              const accounts = await provider.send("eth_requestAccounts", []);
              if (accounts.length > 0) {
                  web3Provider = provider;
                  listenToProviderEvents(window.ethereum);
                  await updateWalletInfo(web3Provider);
              }
          } else if (connector === 'walletConnect') {
              // Fix: The method getWalletProvider() is not available on modern Web3Modal versions.
              // Instead, we subscribe to provider changes before opening the modal.
              let provider: any = null;
              // FIX: The `subscribeProvider` method is not available on this `Web3Modal` version.
              // Replaced with `subscribeState` which is the modern equivalent for observing provider changes.
              // Cast to `any` to bypass strict type-checking as the method might be dynamically available.
              const unsubscribe = (web3Modal as any).subscribeState((newState: any) => {
                  provider = newState.provider;
              });

              await web3Modal.openModal();
              unsubscribe(); // Unsubscribe after modal is closed.
              
              if (provider) {
                  logToConsole('Wallet connected via Web3Modal.', 'info');
                  const browserProvider = new ethers.BrowserProvider(provider);
                  web3Provider = browserProvider;
                  listenToProviderEvents(provider);
                  await updateWalletInfo(web3Provider);
              } else {
                  logToConsole('Web3Modal closed without connection.', 'info');
              }
          } else if (connector === 'cli') {
              logToConsole('Attempting to connect to local CLI wallet at http://localhost:8545...', 'warn');
              const cliProvider = new ethers.JsonRpcProvider('http://localhost:8545');
              try {
                  const network = await cliProvider.getNetwork();
                  logToConsole(`Successfully connected to local node on network: ${network.name}`, 'ok');
                  web3Provider = cliProvider;
                  await updateWalletInfo(web3Provider);
              } catch (cliError) {
                  logToConsole(`CLI wallet connection failed: ${(cliError as Error).message}. Is a local node (like Hardhat/Anvil) with an unlocked account running at http://localhost:8545?`, 'error');
                  disconnectWallet();
              }
          }
      } catch (error) {
          logToConsole(`Wallet connection failed: ${(error as Error).message}`, 'error');
          disconnectWallet();
      }
  }

  async function updateWalletInfo(provider: ethers.BrowserProvider | ethers.JsonRpcProvider) {
    try {
      const signer = await provider.getSigner();
      walletAddress = await signer.getAddress();
      const balance = await provider.getBalance(walletAddress);
      const network = await provider.getNetwork();

      (document.getElementById('header-wallet-info') as HTMLElement).style.display = 'flex';
      (document.getElementById('header-connect-btn') as HTMLElement).style.display = 'none';
      (document.getElementById('header-disconnect-btn') as HTMLElement).style.display = 'block';
      if (showQrBtn) showQrBtn.style.display = 'block';
      
      const walletStatus = document.getElementById('wallet-status-indicator') as HTMLElement;
      walletStatus.classList.remove('disconnected');
      walletStatus.classList.add('connected');
      walletStatus.parentElement?.classList.add('flash-success');
      setTimeout(() => walletStatus.parentElement?.classList.remove('flash-success'), 700);


      (document.getElementById('header-wallet-address') as HTMLElement).textContent = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
      (document.getElementById('header-wallet-balance') as HTMLElement).textContent = `${ethers.formatEther(balance).substring(0, 6)} ETH`;
      (document.getElementById('header-wallet-network') as HTMLElement).textContent = network.name;
      
      logToConsole(`Wallet connected: ${walletAddress} on ${network.name}.`, 'ok');
      updateTradeButtonsState();
    } catch (error) {
        logToConsole(`Failed to update wallet info: ${(error as Error).message}`, 'error');
        disconnectWallet();
    }
  }
  
  // Fix: Convert to async function to support awaiting the disconnect call.
  async function disconnectWallet() {
      if (web3Provider?.provider) {
        removeProviderEvents(web3Provider.provider);
        // FIX: In modern Web3Modal versions, disconnection is handled by the provider (e.g., from WalletConnect), not the modal instance itself.
        if (typeof (web3Provider.provider as any).disconnect === 'function') {
          await (web3Provider.provider as any).disconnect();
        }
      }

      web3Provider = null;
      walletAddress = null;
      
      (document.getElementById('header-wallet-info') as HTMLElement).style.display = 'none';
      (document.getElementById('header-connect-btn') as HTMLElement).style.display = 'block';
      (document.getElementById('header-disconnect-btn') as HTMLElement).style.display = 'none';
      if (showQrBtn) showQrBtn.style.display = 'none';


      const walletStatus = document.getElementById('wallet-status-indicator') as HTMLElement;
      walletStatus.classList.remove('connected');
      walletStatus.classList.add('disconnected');
      
      logToConsole('Wallet disconnected.', 'info');
      updateTradeButtonsState();
  }

  // Event Listeners for wallet buttons
  document.getElementById('connect-metamask-btn')?.addEventListener('click', () => connectWallet('metaMask'));
  document.getElementById('connect-walletconnect-btn')?.addEventListener('click', () => connectWallet('walletConnect'));
  document.getElementById('connect-cli-btn')?.addEventListener('click', () => connectWallet('cli'));
  document.getElementById('header-disconnect-btn')?.addEventListener('click', disconnectWallet);


  // ===============================================
  // API & DATA FETCHING (CoinGecko)
  // ===============================================
  const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
  let coinGeckoApiKey: string | null = null;

  function getCoinGeckoUrl(endpoint: string): string {
    const baseUrl = `${COINGECKO_API_BASE}${endpoint}`;
    if (coinGeckoApiKey) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}x_cg_demo_api_key=${coinGeckoApiKey}`;
    }
    return baseUrl;
  }

  async function checkCoinGeckoApi() {
    const statusEl = document.getElementById('api-status');
    if (!statusEl) return;
    try {
      const response = await fetch(getCoinGeckoUrl('/ping'));
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data.gecko_says) {
        statusEl.textContent = 'OK';
        statusEl.style.color = 'var(--color-neon-green)';
        logToConsole('CoinGecko API status: OK', 'ok');
      }
    } catch (error) {
      statusEl.textContent = 'Error';
      statusEl.style.color = 'var(--color-neon-red)';
      logToConsole(`CoinGecko API error: ${(error as Error).message}`, 'error');
    }
  }

  async function fetchTokens() {
    logToConsole('Fetching token list...', 'info');
    try {
        const response = await fetch(getCoinGeckoUrl('/coins/list?include_platform=true'));
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const tokens = await response.json();
        const ethTokens = tokens.filter((t: any) => t.platforms.ethereum);
        populateTokenSelects(ethTokens);
    } catch (error) {
        logToConsole(`Failed to fetch tokens: ${(error as Error).message}`, 'error');
    }
  }
  
    async function fetchTokenPrice(tokenId: string): Promise<number | null> {
        if (!tokenId) return null;
        try {
            const response = await fetch(getCoinGeckoUrl(`/simple/price?ids=${tokenId}&vs_currencies=usd`));
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const data = await response.json();
            const price = data[tokenId]?.usd;
            if (price === undefined) {
                throw new Error('Price not found in API response.');
            }
            return price;
        } catch (error) {
            logToConsole(`Failed to fetch price for ${tokenId}: ${(error as Error).message}`, 'error');
            return null;
        }
    }

  function populateTokenSelects(tokens: any[]) {
      const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
      const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;
      if (!fromTokenSelect || !toTokenSelect) return;
      
      fromTokenSelect.innerHTML = '<option value="">Select a token</option>';
      toTokenSelect.innerHTML = '<option value="">Select a token</option>';

      // Add some common tokens first
      const commonSymbols = ['weth', 'usdc', 'usdt', 'dai', 'wbtc'];
      const commonTokens = tokens.filter(t => commonSymbols.includes(t.symbol)).reverse();
      const otherTokens = tokens.filter(t => !commonSymbols.includes(t.symbol));

      [...commonTokens, ...otherTokens].slice(0, 200).forEach(token => {
          const option = document.createElement('option');
          option.value = token.id;
          option.textContent = `${token.name} (${token.symbol.toUpperCase()})`;
          (option as any).dataset.address = token.platforms.ethereum;
          fromTokenSelect.appendChild(option.cloneNode(true));
          toTokenSelect.appendChild(option);
      });
      logToConsole('Token list populated.', 'ok');
      
      // Restore saved selections
      const savedFromToken = localStorage.getItem(FROM_TOKEN_KEY);
      const savedToToken = localStorage.getItem(TO_TOKEN_KEY);
      if (savedFromToken) fromTokenSelect.value = savedFromToken;
      if (savedToToken) toTokenSelect.value = savedToToken;

      loadTradingViewWidget();
  }

  async function fetchHotPairs() {
      const listEl = document.getElementById('hot-pairs-list');
      if (!listEl) return;
      try {
          const response = await fetch(getCoinGeckoUrl('/search/trending'));
          if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
          const data = await response.json();
          listEl.innerHTML = ''; // Clear loading message
          data.coins.slice(0, 7).forEach((coinItem: any) => {
              const { item } = coinItem;
              const pairEl = document.createElement('div');
              pairEl.className = 'dex-pair fade-in';
              pairEl.innerHTML = `
                  <div class="dex-pair-logos">
                      <img src="${item.thumb}" alt="${item.name}">
                  </div>
                  <div class="stack" style="text-align: right; gap: 0;">
                      <span class="mono">${item.symbol}/USD</span>
                      <span class="small" style="color: var(--color-neon-green);">${item.data.price}</span>
                  </div>
              `;
              listEl.appendChild(pairEl);
          });
      } catch (error) {
          listEl.innerHTML = '<p class="small" style="color: var(--color-neon-red);">Could not load hot pairs.</p>';
          logToConsole(`Failed to fetch hot pairs: ${(error as Error).message}`, 'error');
      }
  }

  // ===============================================
  // TRADINGVIEW WIDGET
  // ===============================================
  function loadTradingViewWidget(symbol = 'UNISWAP:WETHUSDT') {
    if (typeof TradingView !== 'undefined') {
        try {
            new TradingView.widget({
                "container_id": "tradingview-widget-container",
                "autosize": true,
                "symbol": symbol,
                "interval": "D",
                "timezone": "Etc/UTC",
                "theme": "dark",
                "style": "1",
                "locale": "en",
                "toolbar_bg": "#f1f3f6",
                "enable_publishing": false,
                "hide_side_toolbar": false,
                "allow_symbol_change": true,
                "details": true,
                "hotlist": true,
                "calendar": true,
                "studies": [
                  "Volume@tv-basicstudies"
                ]
            });
            logToConsole('TradingView widget loaded.', 'ok');
        } catch(e) {
            logToConsole('Failed to load TradingView widget.', 'error');
        }
    } else {
        logToConsole('TradingView script not available.', 'warn');
    }
  }
  
  // ===============================================
  // DEX & TRADING LOGIC
  // ===============================================
  const fromAmountInput = document.getElementById('from-amount') as HTMLInputElement;
  const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
  const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;
  const leverageSlider = document.getElementById('leverage-slider') as HTMLInputElement;
  const leverageValueSpan = document.getElementById('leverage-value') as HTMLElement;

  function updateTradeButtonsState() {
    const isConnected = !!walletAddress;
    const swapBtn = document.getElementById('swap-btn') as HTMLButtonElement;
    const aiSignalBtn = document.getElementById('ai-signal-btn') as HTMLButtonElement;
    const buyBtn = document.getElementById('buy-long-btn') as HTMLButtonElement;
    const sellBtn = document.getElementById('sell-short-btn') as HTMLButtonElement;

    if (swapBtn) swapBtn.disabled = !isConnected;
    if (aiSignalBtn) aiSignalBtn.disabled = !isConnected;
    if (buyBtn) buyBtn.disabled = !isConnected;
    if (sellBtn) sellBtn.disabled = !isConnected;
  }
  
  async function executeTrade() {
      if (!fromAmountInput || !fromTokenSelect || !toTokenSelect) {
          logToConsole('Trading UI elements not found.', 'error'); return;
      }
      
      const fromAmount = parseFloat(fromAmountInput.value);
      const fromTokenId = fromTokenSelect.value;
      const toTokenId = toTokenSelect.value;
      const swapBtn = document.getElementById('swap-btn') as HTMLElement;

      if (!fromAmount || !fromTokenId || !toTokenId) {
          logToConsole('Please fill all fields for the swap.', 'error');
          swapBtn.classList.add('flash-error');
          setTimeout(() => swapBtn.classList.remove('flash-error'), 700);
          return;
      }

      const fromTokenOption = fromTokenSelect.options[fromTokenSelect.selectedIndex];
      const toTokenOption = toTokenSelect.options[toTokenSelect.selectedIndex];
      const fromTokenSymbol = fromTokenOption.text.match(/\(([^)]+)\)/)?.[1] || fromTokenOption.value;
      const toTokenSymbol = toTokenOption.text.match(/\(([^)]+)\)/)?.[1] || toTokenOption.value;
      
      logToConsole(`Executing trade: ${fromAmount} ${fromTokenSymbol} -> ${toTokenSymbol}...`, 'info');
      logToConsole('Fetching live prices for simulation...', 'info');
      
      const [fromPrice, toPrice] = await Promise.all([fetchTokenPrice(fromTokenId), fetchTokenPrice(toTokenId)]);

      if (fromPrice === null || toPrice === null) {
          logToConsole('Could not fetch token prices for simulation. Aborting.', 'error');
          return;
      }

      const fromValue = fromAmount * fromPrice;
      const toAmount = fromValue / toPrice;
      
      logToConsole(`SIMULATION: Swapped ${fromAmount.toFixed(4)} ${fromTokenSymbol} (value: $${fromValue.toFixed(2)}) for approximately ${toAmount.toFixed(4)} ${toTokenSymbol}.`, 'ok');

      swapBtn.classList.add('flash-success');
      setTimeout(() => {
          swapBtn.classList.remove('flash-success');
      }, 1500);
  }

  async function executeLeveragedTrade(type: 'BUY' | 'SELL', button: HTMLElement) {
      if (!fromAmountInput || !fromTokenSelect || !leverageSlider) return;
      
      const fromAmount = parseFloat(fromAmountInput.value);
      const fromTokenId = fromTokenSelect.value;
      const leverage = parseInt(leverageSlider.value, 10);

      if (!fromAmount || !fromTokenId) {
          logToConsole('Please input an amount and select a token to trade.', 'error');
          button.classList.add('flash-error');
          setTimeout(() => button.classList.remove('flash-error'), 700);
          return;
      }

      const fromTokenOption = fromTokenSelect.options[fromTokenSelect.selectedIndex];
      const fromTokenSymbol = fromTokenOption.text.match(/\(([^)]+)\)/)?.[1] || fromTokenOption.value;

      logToConsole(`Executing ${type} trade: ${fromAmount} ${fromTokenSymbol} at ${leverage}x leverage...`, 'info');
      logToConsole('Fetching live price for simulation...', 'info');

      const entryPrice = await fetchTokenPrice(fromTokenId);
      if (entryPrice === null) {
          logToConsole(`Could not fetch price for ${fromTokenSymbol}. Aborting simulation.`, 'error');
          return;
      }

      const positionValue = fromAmount * entryPrice * leverage;
      const liquidationPrice = type === 'BUY'
          ? entryPrice * (1 - (1 / leverage))
          : entryPrice * (1 + (1 / leverage));
      
      const simulatedPriceChange = (Math.random() * 0.10) - 0.05; // -5% to +5%
      const exitPrice = entryPrice * (1 + simulatedPriceChange);
      
      let pnl;
      if (type === 'BUY') {
          pnl = ((exitPrice - entryPrice) / entryPrice) * positionValue;
      } else { // SELL
          pnl = ((entryPrice - exitPrice) / entryPrice) * positionValue;
      }

      logToConsole(`SIMULATION [${type}]: Opened ${leverage}x ${fromTokenSymbol} position worth $${positionValue.toFixed(2)}.`, 'ok');
      logToConsole(`> Entry Price: $${entryPrice.toFixed(4)}. Est. Liquidation: $${liquidationPrice.toFixed(4)}.`, 'info');
      logToConsole(`> Simulating a ${(simulatedPriceChange * 100).toFixed(2)}% price change to $${exitPrice.toFixed(4)}...`, 'info');
      logToConsole(`> Resulting PnL: $${pnl.toFixed(2)} (${pnl > 0 ? 'Profit' : 'Loss'}).`, pnl > 0 ? 'ok' : 'error');

      button.classList.add('flash-success');
      setTimeout(() => {
          button.classList.remove('flash-success');
      }, 1500);
  }

  // Leverage slider update
  if (leverageSlider && leverageValueSpan) {
    leverageSlider.addEventListener('input', () => {
        leverageValueSpan.textContent = `${leverageSlider.value}x`;
        localStorage.setItem(LEVERAGE_KEY, leverageSlider.value);
    });
  }
  // Leverage preset buttons
  document.getElementById('leverage-presets')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('.leverage-preset-btn')) {
          const value = target.dataset.value;
          if (value && leverageSlider && leverageValueSpan) {
              leverageSlider.value = value;
              leverageValueSpan.textContent = `${value}x`;
              localStorage.setItem(LEVERAGE_KEY, value);
          }
      }
  });

  // Event listeners for trade buttons
  document.getElementById('swap-btn')?.addEventListener('click', executeTrade);
  document.getElementById('buy-long-btn')?.addEventListener('click', (e) => executeLeveragedTrade('BUY', e.currentTarget as HTMLElement));
  document.getElementById('sell-short-btn')?.addEventListener('click', (e) => executeLeveragedTrade('SELL', e.currentTarget as HTMLElement));
  fromTokenSelect?.addEventListener('change', () => localStorage.setItem(FROM_TOKEN_KEY, fromTokenSelect.value));
  toTokenSelect?.addEventListener('change', () => localStorage.setItem(TO_TOKEN_KEY, toTokenSelect.value));


  // ===============================================
  // AI CORE (Ollama)
  // ===============================================
  let ollamaApiUrl = localStorage.getItem('ollamaApiUrl') || 'http://localhost:11434';
  let ollamaModelName = localStorage.getItem('ollamaModelName') || 'llama3';
  let ollamaTemperature = localStorage.getItem('ollama_temperature') || '0.8';
  let ollamaMaxTokens = localStorage.getItem('ollama_max_tokens') || '-1';
  
  (document.getElementById('ollama-api-url') as HTMLInputElement).value = ollamaApiUrl;
  (document.getElementById('ollama-model-name') as HTMLInputElement).value = ollamaModelName;
  (document.getElementById('ollama-temperature') as HTMLInputElement).value = ollamaTemperature;
  (document.getElementById('ollama-max-tokens') as HTMLInputElement).value = ollamaMaxTokens;

  let aiChatHistory: { role: 'user' | 'assistant', content: string }[] = [];
  const aiStatusIndicator = document.getElementById('ai-status-indicator') as HTMLElement;

  function renderAiChatHistory() {
      const historyEl = document.getElementById('ai-chat-history');
      if (!historyEl) return;
      historyEl.innerHTML = '';
      aiChatHistory.forEach(msg => {
          const msgEl = document.createElement('div');
          msgEl.className = `chat-message ${msg.role}-message`;
          msgEl.textContent = msg.content;
          historyEl.appendChild(msgEl);
      });
      historyEl.scrollTop = historyEl.scrollHeight;
  }

  function saveAiChatHistory() {
      localStorage.setItem(AI_CHAT_HISTORY_KEY, JSON.stringify(aiChatHistory));
  }

  function loadAiChatHistory() {
      const storedHistory = localStorage.getItem(AI_CHAT_HISTORY_KEY);
      if (storedHistory) {
          aiChatHistory = JSON.parse(storedHistory);
          renderAiChatHistory();
      }
  }

  async function checkAiStatus() {
      if (!aiStatusIndicator) return;
      aiStatusIndicator.classList.remove('connected', 'disconnected');
      aiStatusIndicator.classList.add('checking');
      aiStatusIndicator.dataset.tooltip = 'Checking AI Core...';

      try {
          const response = await fetch(`${ollamaApiUrl}/api/tags`, {
              signal: AbortSignal.timeout(5000) 
          });
          if (!response.ok) throw new Error('API not responding');
          
          aiStatusIndicator.classList.add('connected');
          aiStatusIndicator.dataset.tooltip = 'AI Core Connected';
      } catch (error) {
          aiStatusIndicator.classList.add('disconnected');
          aiStatusIndicator.dataset.tooltip = 'AI Core Disconnected. Is Ollama running?';
      } finally {
          aiStatusIndicator.classList.remove('checking');
      }
  }

  async function queryOllama(prompt: string) {
    logToConsole('Querying AI Core...', 'info');
    try {
        const temperature = parseFloat(ollamaTemperature);
        const num_predict = parseInt(ollamaMaxTokens, 10);

        const response = await fetch(`${ollamaApiUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: ollamaModelName,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: isNaN(temperature) ? 0.8 : temperature,
                    num_predict: isNaN(num_predict) ? -1 : num_predict
                }
            })
        });
        if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);
        const data = await response.json();
        logToConsole(`AI Response: ${data.response}`, 'ok');

        aiChatHistory[aiChatHistory.length - 1].content = data.response;
        saveAiChatHistory();
        renderAiChatHistory();

    } catch (error) {
        const errorMessage = `AI Core Error: ${(error as Error).message}. Is Ollama running?`;
        logToConsole(errorMessage, 'error');
        aiChatHistory[aiChatHistory.length - 1].content = `Sorry, I encountered an error: ${(error as Error).message}`;
        saveAiChatHistory();
        renderAiChatHistory();
        checkAiStatus(); // Update status on error
    }
  }
  
    async function sendChatMessage() {
        const input = document.getElementById('ai-chat-input') as HTMLInputElement;
        const prompt = input.value.trim();
        if (!prompt) return;

        aiChatHistory.push({ role: 'user', content: prompt });
        aiChatHistory.push({ role: 'assistant', content: '...' });
        saveAiChatHistory();
        renderAiChatHistory();
        input.value = '';

        await queryOllama(prompt);
    }

  async function getAiTradeSignal() {
      if (!fromTokenSelect || !toTokenSelect || !leverageSlider) return;
      
      if (fromTokenSelect.selectedIndex <= 0 || toTokenSelect.selectedIndex <= 0) {
          logToConsole('Please select both tokens to get an AI signal.', 'error');
          (document.getElementById('ai-signal-btn') as HTMLElement).classList.add('flash-error');
          return;
      }

      const fromTokenId = fromTokenSelect.value;
      const toTokenId = toTokenSelect.value;
      const leverage = leverageSlider.value;
      
      const fromTokenText = fromTokenSelect.options[fromTokenSelect.selectedIndex].text;
      const toTokenText = toTokenSelect.options[toTokenSelect.selectedIndex].text;
      
      logToConsole('Fetching prices for AI context...', 'info');
      const [fromPrice, toPrice] = await Promise.all([fetchTokenPrice(fromTokenId), fetchTokenPrice(toTokenId)]);
      
      let priceContext = "Current prices are unavailable.";
      if(fromPrice !== null && toPrice !== null) {
        priceContext = `The current price of ${fromTokenText} is approximately $${fromPrice.toFixed(4)} and ${toTokenText} is $${toPrice.toFixed(4)}.`;
      }

      const prompt = `Analyze the current market sentiment for a trade between ${fromTokenText} and ${toTokenText}. ${priceContext} I am considering a trade with ${leverage}x leverage. Based on this data, should I execute a BUY/LONG or a SELL/SHORT position? Provide a brief justification for your recommendation.`;
      
      aiChatHistory.push({ role: 'user', content: prompt });
      aiChatHistory.push({ role: 'assistant', content: '...' });
      saveAiChatHistory();
      renderAiChatHistory();

      await queryOllama(prompt);
  }
  
  document.getElementById('ai-signal-btn')?.addEventListener('click', getAiTradeSignal);
  document.getElementById('ai-chat-send-btn')?.addEventListener('click', sendChatMessage);
  document.getElementById('ai-chat-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
          sendChatMessage();
      }
  });

  document.getElementById('save-settings-btn')?.addEventListener('click', () => {
      ollamaApiUrl = (document.getElementById('ollama-api-url') as HTMLInputElement).value;
      ollamaModelName = (document.getElementById('ollama-model-name') as HTMLInputElement).value;
      ollamaTemperature = (document.getElementById('ollama-temperature') as HTMLInputElement).value;
      ollamaMaxTokens = (document.getElementById('ollama-max-tokens') as HTMLInputElement).value;
      const newApiKey = (document.getElementById('coingecko-api-key') as HTMLInputElement).value.trim();

      localStorage.setItem('ollamaApiUrl', ollamaApiUrl);
      localStorage.setItem('ollamaModelName', ollamaModelName);
      localStorage.setItem('ollama_temperature', ollamaTemperature);
      localStorage.setItem('ollama_max_tokens', ollamaMaxTokens);
      
      if (newApiKey) {
          localStorage.setItem(COINGECKO_API_KEY, newApiKey);
          coinGeckoApiKey = newApiKey;
      } else {
          localStorage.removeItem(COINGECKO_API_KEY);
          coinGeckoApiKey = null;
      }

      logToConsole('Settings saved.', 'ok');
      checkAiStatus(); // Re-check status after saving
      checkCoinGeckoApi();
  });


  // ===============================================
  // RECURRING TASKS
  // ===============================================
  let tasks: { id: number, text: string, frequency: string }[] = [];

  function loadTasks() {
      try {
          const storedTasks = localStorage.getItem(RECURRING_TASKS_KEY);
          if (storedTasks) {
              const parsedTasks = JSON.parse(storedTasks);
              // Fix: Validate that the stored data is an array before assigning it
              if (Array.isArray(parsedTasks)) {
                  tasks = parsedTasks;
              } else {
                  throw new Error("Stored tasks are not in the correct format.");
              }
          }
      // Fix: Corrected invalid 'catch (error) =>' syntax to 'catch (error)'
      } catch (error) {
          logToConsole('Error loading recurring tasks. Resetting tasks.', 'error');
          tasks = [];
          localStorage.removeItem(RECURRING_TASKS_KEY);
      }
  }

  function saveTasks() {
      localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(tasks));
  }

  function renderTasks() {
      const taskList = document.getElementById('recurring-task-list');
      if (!taskList) return;
      taskList.innerHTML = '';
      tasks.forEach(task => {
          const taskEl = document.createElement('div');
          taskEl.className = 'row fade-in';
          taskEl.style.justifyContent = 'space-between';
          taskEl.innerHTML = `
              <div>
                  <span>${task.text}</span>
                  <span class="tag mono">${task.frequency}</span>
              </div>
              <button class="delete-task-btn" data-id="${task.id}" style="background:none; box-shadow:none; color: var(--color-neon-red);">X</button>
          `;
          taskList.appendChild(taskEl);
      });
  }

  function addTask(text: string, frequency: string) {
      const newTask = { id: Date.now(), text, frequency };
      tasks.push(newTask);
      saveTasks();
      renderTasks();
  }
  
  document.getElementById('recurring-task-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('recurring-task-input') as HTMLInputElement;
      const select = document.getElementById('recurring-task-select') as HTMLSelectElement;
      if (input.value.trim()) {
          addTask(input.value.trim(), select.value);
          input.value = '';
      }
  });

  document.getElementById('recurring-task-list')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('.delete-task-btn')) {
          const taskId = Number(target.dataset.id);
          tasks = tasks.filter(task => task.id !== taskId);
          saveTasks();
          renderTasks();
      }
  });


  // ===============================================
  // CRYPTO OPS
  // ===============================================
  // Hashing
  document.getElementById('hash-btn')?.addEventListener('click', async () => {
    const input = (document.getElementById('hash-input') as HTMLTextAreaElement).value;
    const outputEl = document.getElementById('hash-output') as HTMLElement;
    if (!input) return;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      outputEl.textContent = hashHex;
      outputEl.style.display = 'block';
    } catch(e) {
      outputEl.textContent = 'Error hashing data.';
    }
  });

  // AES Encryption/Decryption
  const aesInput = document.getElementById('aes-input') as HTMLTextAreaElement;
  const aesPassword = document.getElementById('aes-password') as HTMLInputElement;
  const aesOutput = document.getElementById('aes-output') as HTMLElement;
  
  async function getAesKey(password: string) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
          'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveKey']
      );
      return await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc.encode('salt'), iterations: 100000, hash: 'SHA-256' },
          keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
  }

  function base64ToArrayBuffer(base64: string) {
      const binary_string = window.atob(base64);
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
          bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
  }
  
  document.getElementById('aes-encrypt-btn')?.addEventListener('click', async () => {
      if (!aesInput.value || !aesPassword.value) return;
      try {
          const key = await getAesKey(aesPassword.value);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const encrypted = await crypto.subtle.encrypt(
              { name: 'AES-GCM', iv }, key, new TextEncoder().encode(aesInput.value)
          );
          aesOutput.textContent = `${arrayBufferToBase64(iv)}:${arrayBufferToBase64(encrypted)}`;
          aesOutput.style.display = 'block';
      } catch (e) {
          aesOutput.textContent = 'Encryption failed.';
      }
  });
  
  document.getElementById('aes-decrypt-btn')?.addEventListener('click', async () => {
      if (!aesInput.value || !aesPassword.value) return;
      try {
          const [ivBase64, encryptedBase64] = aesInput.value.split(':');
          if (!ivBase64 || !encryptedBase64) throw new Error("Invalid format");
          
          const key = await getAesKey(aesPassword.value);
          const decrypted = await crypto.subtle.decrypt(
              { name: 'AES-GCM', iv: base64ToArrayBuffer(ivBase64) }, 
              key, 
              base64ToArrayBuffer(encryptedBase64)
          );
          aesOutput.textContent = new TextDecoder().decode(decrypted);
          aesOutput.style.display = 'block';
      } catch (e) {
          aesOutput.textContent = 'Decryption failed. Check password or ciphertext.';
      }
  });


  // ===============================================
  // SEED TOOL
  // ===============================================
  document.getElementById('analyze-seed-btn')?.addEventListener('click', () => {
    const phrase = (document.getElementById('seed-phrase-input') as HTMLTextAreaElement).value.trim();
    const outputEl = document.getElementById('seed-analysis-output') as HTMLElement;
    if (!phrase) return;

    outputEl.style.display = 'block';
    outputEl.innerHTML = ''; // Clear previous results

    const renderResult = (label: string, value: string, valid?: boolean) => {
      const row = document.createElement('div');
      row.className = 'result-row';
      let valueClass = '';
      if (valid === true) valueClass = 'valid';
      if (valid === false) valueClass = 'invalid';

      row.innerHTML = `<span class="result-label">${label}</span><span class="result-value mono ${valueClass}">${value}</span>`;
      outputEl.appendChild(row);
    };

    try {
      const words = phrase.split(/\s+/);
      renderResult('Word Count', words.length.toString(), [12, 15, 18, 21, 24].includes(words.length));

      const isValid = bip39.validateMnemonic(phrase);
      renderResult('BIP39 Valid', isValid.toString().toUpperCase(), isValid);

      if (isValid) {
        const entropy = bip39.mnemonicToEntropy(phrase);
        renderResult('Entropy (Hex)', entropy);
        const seed = bip39.mnemonicToSeedSync(phrase).toString('hex');
        renderResult('Seed (Hex)', seed.substring(0, 32) + '...');
      }
    } catch (e) {
        renderResult('Error', (e as Error).message, false);
    }
  });
  
  
  // ===============================================
  // HRC203X KANBAN
  // ===============================================
  let kanbanTasks: {
      backlog: any[],
      inprogress: any[],
      completed: any[]
  } = {
      backlog: [],
      inprogress: [],
      completed: []
  };

  function loadKanbanTasks() {
      try {
          const storedTasks = localStorage.getItem(KANBAN_TASKS_KEY);
          if (storedTasks) {
              const parsed = JSON.parse(storedTasks);
              // Fix: Validate structure of stored Kanban data
              if (parsed && parsed.backlog && parsed.inprogress && parsed.completed) {
                  kanbanTasks = parsed;
              } else {
                  throw new Error("Invalid Kanban data structure");
              }
          }
      // Fix: Corrected invalid 'catch (error) =>' syntax to 'catch (error)'
      } catch (error) {
          logToConsole('Error loading Kanban tasks. Resetting board.', 'error');
          kanbanTasks = { backlog: [], inprogress: [], completed: [] };
          localStorage.removeItem(KANBAN_TASKS_KEY);
      }
  }

  function saveKanbanTasks() {
      localStorage.setItem(KANBAN_TASKS_KEY, JSON.stringify(kanbanTasks));
  }

  function createKanbanTaskElement(task: any) {
      const taskEl = document.createElement('div');
      taskEl.className = 'kanban-task';
      taskEl.draggable = true;
      taskEl.dataset.id = task.id;
      taskEl.innerHTML = `
          <button class="delete-task-btn" data-id="${task.id}">X</button>
          <strong>${task.title}</strong>
          <p>${task.desc}</p>
      `;
      return taskEl;
  }

  function renderKanbanBoard() {
      for (const status in kanbanTasks) {
          const column = document.querySelector(`.kanban-column[data-status="${status}"] .kanban-tasks`);
          if (column) {
              column.innerHTML = '';
              (kanbanTasks as any)[status].forEach((task: any) => {
                  column.appendChild(createKanbanTaskElement(task));
              });
          }
      }
  }
  
  document.getElementById('add-task-btn')?.addEventListener('click', () => {
      const titleInput = document.getElementById('new-task-title') as HTMLInputElement;
      const descInput = document.getElementById('new-task-desc') as HTMLTextAreaElement;
      if (titleInput.value.trim()) {
          const newTask = {
              id: `task-${Date.now()}`,
              title: titleInput.value.trim(),
              desc: descInput.value.trim()
          };
          kanbanTasks.backlog.push(newTask);
          saveKanbanTasks();
          renderKanbanBoard();
          titleInput.value = '';
          descInput.value = '';
      }
  });

  // Drag and Drop Logic
  let draggedItemId: string | null = null;
  document.getElementById('kanban-board')?.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('kanban-task')) {
          draggedItemId = target.dataset.id || null;
          setTimeout(() => target.classList.add('dragging'), 0);
      }
  });

  document.getElementById('kanban-board')?.addEventListener('dragend', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('kanban-task')) {
          target.classList.remove('dragging');
          draggedItemId = null;
      }
  });

  document.querySelectorAll('.kanban-column').forEach(column => {
      column.addEventListener('dragover', (e) => {
          e.preventDefault();
          column.classList.add('drag-over');
      });
      column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
      column.addEventListener('drop', (e) => {
          e.preventDefault();
          column.classList.remove('drag-over');
          const newStatus = (column as HTMLElement).dataset.status as keyof typeof kanbanTasks;
          if (draggedItemId && newStatus) {
              let taskToMove;
              let oldStatus;
              for (const status in kanbanTasks) {
                  const taskIndex = (kanbanTasks as any)[status].findIndex((t: any) => t.id === draggedItemId);
                  if (taskIndex > -1) {
                      taskToMove = (kanbanTasks as any)[status].splice(taskIndex, 1)[0];
                      oldStatus = status;
                      break;
                  }
              }
              if (taskToMove) {
                  kanbanTasks[newStatus].push(taskToMove);
                  saveKanbanTasks();
                  renderKanbanBoard();
              }
          }
      });
  });
  
  document.getElementById('kanban-board')?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.matches('.delete-task-btn')) {
          const taskId = target.dataset.id;
          for (const status in kanbanTasks) {
              (kanbanTasks as any)[status] = (kanbanTasks as any)[status].filter((t: any) => t.id !== taskId);
          }
          saveKanbanTasks();
          renderKanbanBoard();
      }
  });


  // ===============================================
  // NFT FRIEND CAROUSEL
  // ===============================================
    const nftData = [
    { name: "Neon Wanderer", id: "#3021", artist: "Cypher", image: "https://images.unsplash.com/photo-1639428902523-187538356391?q=80&w=800&auto=format&fit=crop", attributes: { "Background": "Quantum Grid", "Class": "Scout", "Power": "88" }},
    { name: "Glitch Nomad", id: "#7742", artist: "Vector", image: "https://images.unsplash.com/photo-1641785203773-2d219741b1c3?q=80&w=800&auto=format&fit=crop", attributes: { "Background": "Data Stream", "Class": "Hacker", "Power": "92" }},
    { name: "Aether Runner", id: "#0110", artist: "Aris", image: "https://images.unsplash.com/photo-1638897218649-4475e71465ad?q=80&w=800&auto=format&fit=crop", attributes: { "Background": "Skyline", "Class": "Racer", "Power": "95" }},
    { name: "Void Stalker", id: "#9001", artist: "Cypher", image: "https://images.unsplash.com/photo-1638361029221-953e54d6f1a8?q=80&w=800&auto=format&fit=crop", attributes: { "Background": "Abyss", "Class": "Assassin", "Power": "98" }},
    { name: "Chroma Knight", id: "#4588", artist: "Vector", image: "https://images.unsplash.com/photo-1640588863212-a0e2815ea8c4?q=80&w=800&auto=format&fit=crop", attributes: { "Background": "RGB Field", "Class": "Guardian", "Power": "85" }},
  ];

  const carousel = document.querySelector('.carousel');
  if(carousel){
      const cellCount = nftData.length;
      const theta = 360 / cellCount;
      nftData.forEach((nft, i) => {
        const card = document.createElement('div');
        card.className = 'carousel-card';
        const rotateY = `rotateY(${i * theta}deg) translateZ(350px)`;
        card.style.transform = rotateY;
        
        card.innerHTML = `
          <div class="carousel-card__face carousel-card__face--front" style="background-image: url('${nft.image}')"></div>
          <div class="carousel-card__face carousel-card__face--back">
            <h5>${nft.name} <span class="mono">${nft.id}</span></h5>
            <p class="small">by ${nft.artist}</p>
            <hr class="sep">
            ${Object.entries(nft.attributes).map(([key, value]) => `<p class="small mono">${key}: ${value}</p>`).join('')}
          </div>
        `;
        carousel.appendChild(card);
      });

      let rotation = 0;
      document.getElementById('carousel-next-btn')?.addEventListener('click', () => {
        rotation -= theta;
        (carousel as HTMLElement).style.transform = `rotateY(${rotation}deg)`;
      });
      document.getElementById('carousel-prev-btn')?.addEventListener('click', () => {
        rotation += theta;
        (carousel as HTMLElement).style.transform = `rotateY(${rotation}deg)`;
      });
  }


  // ===============================================
  // SYSTEM & INITIALIZATION
  // ===============================================
  function loadPersistentSettings() {
      const savedLeverage = localStorage.getItem(LEVERAGE_KEY);
      if (savedLeverage && leverageSlider && leverageValueSpan) {
          leverageSlider.value = savedLeverage;
          leverageValueSpan.textContent = `${savedLeverage}x`;
      }
      
      const savedApiKey = localStorage.getItem(COINGECKO_API_KEY);
      if (savedApiKey) {
          coinGeckoApiKey = savedApiKey;
          (document.getElementById('coingecko-api-key') as HTMLInputElement).value = savedApiKey;
      }
  }

  document.getElementById('check-api-btn')?.addEventListener('click', checkCoinGeckoApi);
  document.getElementById('clear-data-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all local data? This cannot be undone.')) {
          localStorage.removeItem(RECURRING_TASKS_KEY);
          localStorage.removeItem(KANBAN_TASKS_KEY);
          localStorage.removeItem('ollamaApiUrl');
          localStorage.removeItem('ollamaModelName');
          localStorage.removeItem('ollama_temperature');
          localStorage.removeItem('ollama_max_tokens');
          localStorage.removeItem(FROM_TOKEN_KEY);
          localStorage.removeItem(TO_TOKEN_KEY);
          localStorage.removeItem(LEVERAGE_KEY);
          localStorage.removeItem(AI_CHAT_HISTORY_KEY);
          localStorage.removeItem(COINGECKO_API_KEY);
          logToConsole('All local data cleared.', 'warn');
          loadTasks();
          renderTasks();
          loadKanbanTasks();
          renderKanbanBoard();
          window.location.reload(); // Reload to apply cleared settings
      }
  });

  // Initial calls on page load
  logToConsole('NEMODIAN COREMOVEMENT initialized.', 'info');
  updateTradeButtonsState();
  loadPersistentSettings();
  fetchTokens();
  fetchHotPairs();
  checkCoinGeckoApi();
  loadTasks();
  renderTasks();
  loadKanbanTasks();
  renderKanbanBoard();
  loadAiChatHistory();
  checkAiStatus();
  setInterval(checkAiStatus, 30000); // Check AI status every 30 seconds
});