
import * as bip39 from 'bip39';
import { Web3Modal } from '@web3modal/standalone';
import { ethers } from 'https://esm.run/ethers';
import QRCode from 'qrcode';


// Declare VANTA to make it available in TypeScript
declare var VANTA: any;
// Declare TradingView for the widget
declare var TradingView: any;
// Declare gsap
declare var gsap: any;
// Declare jQuery
declare var $: any;


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
// GLOBAL TERMINAL LOGGER
// ===============================================
const termOutput = document.getElementById('termOutput') as HTMLElement;
function logToTerminal(message: string, type: string = 'info') {
  const logEntry = document.createElement('div');
  logEntry.className = `log-${type}`;

  const isSystemLog = ['info', 'ok', 'warn', 'error'].includes(type);

  if (isSystemLog) {
    const timestamp = new Date().toLocaleTimeString();
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-timestamp';
    timeSpan.textContent = `[${timestamp}]`;
    logEntry.appendChild(timeSpan);
  }

  const msgSpan = document.createElement('span');
  msgSpan.className = 'log-content';
  // Add leading space only for system logs that have a timestamp.
  // Other types like 'user-prompt' will have their prefix/spacing handled by CSS.
  msgSpan.textContent = isSystemLog ? ` ${message}` : message;
  logEntry.appendChild(msgSpan);

  gsap.from(logEntry, { duration: 0.5, opacity: 0, y: 10, ease: "power2.out" });
  termOutput.appendChild(logEntry);
  termOutput.scrollTop = termOutput.scrollHeight;
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
              logToTerminal(`Failed to generate QR code: ${(err as Error).message}`, 'error');
          }
      }
  };
  const closeQrModal = () => qrModal && (qrModal.style.display = 'none');

  if (showQrBtn) showQrBtn.addEventListener('click', openQrModal);
  if (closeQrModalBtn) closeQrModalBtn.addEventListener('click', closeQrModal);

  // ===============================================
  // HUD & TERMINAL INTERACTIVITY
  // ===============================================
  
  // --- Elements ---
  const $hudWidgets = $('#hudWidgets');
  const $hudMenu = $('#hudMenu');
  const $term = $('#term');
  const $termMenu = $('#termMenu');
  const $termInput = $('#termInput');
  const $hudStatus = $('#hudStatus');
  const $aiStatusIndicator = $('#ai-status-indicator');


  // --- Theme Sync Manager ---
  const neonThemes = ["#00ffcc", "#ff00ff", "#ffff33", "#00ff00"];
  let currentThemeIndex = 0;

  function applyTheme(color: string) {
    const elementsToTheme = $hudWidgets.add($term);
    elementsToTheme.css({
      'border-color': color,
      'box-shadow': `0 0 12px ${color}`
    });
    $hudWidgets.find('div').css({
      'color': color,
      'text-shadow': `0 0 6px ${color}`
    });
    $('#termOutput, #termInput').css({
      'color': color
    });
    ($termInput as any).css('caret-color', color);
    $termInput.css('border-top-color', color);
    localStorage.setItem("neonTheme", color);
  }

  function switchTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % neonThemes.length;
    applyTheme(neonThemes[currentThemeIndex]);
  }

  // --- HUD Drag + Save ---
  $hudWidgets.on('mousedown', function(e: any) {
    e.preventDefault();
    const offset = $(this).offset()!;
    const dragOffsetX = e.clientX - offset.left;
    const dragOffsetY = e.clientY - offset.top;

    $(document).on('mousemove.hud', function(e: any) {
      $hudWidgets.css({
        top: e.clientY - dragOffsetY + 'px',
        left: e.clientX - dragOffsetX + 'px',
        right: 'auto',
        bottom: 'auto'
      });
    });

    $(document).on('mouseup.hud', function() {
      $(document).off('mousemove.hud mouseup.hud');
      localStorage.setItem("hudWidgetsPos", JSON.stringify({ top: $hudWidgets.css('top'), left: $hudWidgets.css('left') }));
    });
  });
  
  // --- Context Menus ---
  $hudWidgets.on('contextmenu', function(e: any) {
    e.preventDefault();
    $('.ctxMenu').hide();
    $hudMenu.css({ display: 'flex', left: e.pageX + 'px', top: e.pageY + 'px' });
  });
  $('#hudReset').on('click', () => {
    $hudWidgets.css({ top: '10px', right: '15px', left: 'auto', bottom: 'auto' });
    localStorage.removeItem("hudWidgetsPos");
    $hudMenu.hide();
  });
  $('#hudTheme').on('click', () => {
    switchTheme();
    $hudMenu.hide();
  });

  $term.on('contextmenu', function(e: any) {
    e.preventDefault();
    $('.ctxMenu').hide();
    $termMenu.css({ display: 'flex', left: e.pageX + 'px', top: e.pageY + 'px' });
  });
  $('#termClear').on('click', () => {
    $('#termOutput').html('');
    $termMenu.hide();
  });
  $('#termCopy').on('click', () => {
    navigator.clipboard.writeText($('#termOutput').text()).then(() => logToTerminal("Terminal content copied to clipboard.", 'ok'));
    $termMenu.hide();
  });
  $('#termTheme').on('click', () => {
    switchTheme();
    $termMenu.hide();
  });
  
  // --- Hide menus on outside click ---
  $(document).on('click', (e: any) => {
      if (!$(e.target).closest('.ctxMenu').length && !$(e.target).closest('#hudWidgets, #term').length) {
        $('.ctxMenu').hide();
      }
  });

  // --- Keyboard Shortcuts ---
  $(document).on('keydown', function(e: any) {
    if (e.ctrlKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      $('#hudReset').trigger('click');
    }
    if (e.ctrlKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      switchTheme();
    }
  });
  
  // --- Load saved settings ---
  function loadHudAndTerminalSettings() {
      const savedTheme = localStorage.getItem("neonTheme");
      if (savedTheme) {
          currentThemeIndex = neonThemes.indexOf(savedTheme) >= 0 ? neonThemes.indexOf(savedTheme) : 0;
          applyTheme(savedTheme);
      } else {
          applyTheme(neonThemes[0]);
      }

      const savedPos = localStorage.getItem("hudWidgetsPos");
      if (savedPos) {
          try {
            const p = JSON.parse(savedPos);
            if(p && typeof p === 'object' && p.top && p.left) {
              $hudWidgets.css({ top: p.top, left: p.left, right: 'auto' });
            }
          } catch(e) {
            localStorage.removeItem("hudWidgetsPos");
          }
      }
  }

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
          logToTerminal('Wallet account changed. Updating...', 'info');
          const newProvider = web3Provider?.provider ? new ethers.BrowserProvider(web3Provider.provider) : null;
          if (newProvider) {
              updateWalletInfo(newProvider);
          }
      } else {
          logToTerminal('Wallet disconnected all accounts.', 'info');
          disconnectWallet();
      }
  };

  const handleDisconnect = () => {
      logToTerminal('Provider disconnected from chain.', 'warn');
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
      logToTerminal(`Attempting connection with ${connector}...`, 'info');
      try {
          if (connector === 'metaMask') {
              if (!window.ethereum) {
                  logToTerminal('MetaMask not detected. Please install the extension.', 'error');
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
              let provider: any = null;
              const unsubscribe = (web3Modal as any).subscribeState((newState: any) => {
                  provider = newState.provider;
              });

              await web3Modal.openModal();
              unsubscribe();
              
              if (provider) {
                  logToTerminal('Wallet connected via Web3Modal.', 'info');
                  const browserProvider = new ethers.BrowserProvider(provider);
                  web3Provider = browserProvider;
                  listenToProviderEvents(provider);
                  await updateWalletInfo(web3Provider);
              } else {
                  logToTerminal('Web3Modal closed without connection.', 'info');
              }
          } else if (connector === 'cli') {
              logToTerminal('Attempting to connect to local CLI wallet at http://localhost:8545...', 'warn');
              const cliProvider = new ethers.JsonRpcProvider('http://localhost:8545');
              try {
                  const network = await cliProvider.getNetwork();
                  logToTerminal(`Successfully connected to local node on network: ${network.name}`, 'ok');
                  web3Provider = cliProvider;
                  await updateWalletInfo(web3Provider);
              } catch (cliError) {
                  logToTerminal(`CLI wallet connection failed: ${(cliError as Error).message}. Is a local node (like Hardhat/Anvil) with an unlocked account running at http://localhost:8545?`, 'error');
                  await disconnectWallet();
              }
          }
      } catch (error) {
          logToTerminal(`Wallet connection failed: ${(error as Error).message}`, 'error');
          await disconnectWallet();
      }
  }

  async function updateWalletInfo(provider: ethers.BrowserProvider | ethers.JsonRpcProvider) {
    try {
      const signer = await provider.getSigner();
      walletAddress = await signer.getAddress();
      const balance = await provider.getBalance(walletAddress);
      const network = await provider.getNetwork();

      const walletInfoEl = document.getElementById('header-wallet-info');
      if (walletInfoEl) walletInfoEl.style.display = 'flex';
      
      const connectBtn = document.getElementById('header-connect-btn');
      if (connectBtn) connectBtn.style.display = 'none';

      const disconnectBtn = document.getElementById('header-disconnect-btn');
      if (disconnectBtn) disconnectBtn.style.display = 'block';

      if (showQrBtn) showQrBtn.style.display = 'block';
      
      const walletStatus = document.getElementById('wallet-status-indicator');
      if(walletStatus) {
        walletStatus.classList.remove('disconnected');
        walletStatus.classList.add('connected');
        walletStatus.parentElement?.classList.add('flash-success');
        setTimeout(() => walletStatus.parentElement?.classList.remove('flash-success'), 700);
      }

      const addressEl = document.getElementById('header-wallet-address');
      if(addressEl) addressEl.textContent = `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`;
      
      const balanceEl = document.getElementById('header-wallet-balance');
      if(balanceEl) balanceEl.textContent = `${ethers.formatEther(balance).substring(0, 6)} ETH`;
      
      const networkEl = document.getElementById('header-wallet-network');
      if(networkEl) networkEl.textContent = network.name;
      
      logToTerminal(`Wallet connected: ${walletAddress} on ${network.name}.`, 'ok');
      updateTradeButtonsState();
    } catch (error) {
        logToTerminal(`Failed to update wallet info: ${(error as Error).message}`, 'error');
        await disconnectWallet();
    }
  }
  
  async function disconnectWallet() {
      if (web3Provider?.provider) {
        removeProviderEvents(web3Provider.provider);
        if (typeof (web3Provider.provider as any).disconnect === 'function') {
          await (web3Provider.provider as any).disconnect();
        }
      }

      web3Provider = null;
      walletAddress = null;
      
      const walletInfoEl = document.getElementById('header-wallet-info');
      if(walletInfoEl) walletInfoEl.style.display = 'none';
      
      const connectBtn = document.getElementById('header-connect-btn');
      if(connectBtn) connectBtn.style.display = 'block';

      const disconnectBtn = document.getElementById('header-disconnect-btn');
      if(disconnectBtn) disconnectBtn.style.display = 'none';

      if (showQrBtn) showQrBtn.style.display = 'none';

      const walletStatus = document.getElementById('wallet-status-indicator');
      if (walletStatus) {
        walletStatus.classList.remove('connected');
        walletStatus.classList.add('disconnected');
      }
      
      logToTerminal('Wallet disconnected.', 'info');
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
      statusEl.textContent = 'Pinging...';
      statusEl.className = 'small mono';
      const response = await fetch(getCoinGeckoUrl('/ping'));
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data && data.gecko_says) {
          logToTerminal(`CoinGecko API check successful: ${data.gecko_says}`, 'ok');
          statusEl.textContent = 'Status: OK';
      } else {
          throw new Error('Unexpected API response.');
      }
    } catch (err) {
        if(statusEl) statusEl.textContent = 'Status: Error';
        logToTerminal(`CoinGecko API check failed: ${(err as Error).message}`, 'error');
    }
  }

    // ===============================================
    // TOKEN DATA & DEX UI
    // ===============================================
    let tokenListCache: { id: string; symbol: string; name: string }[] = [];

    async function fetchAndPopulateTokens() {
        logToTerminal('Fetching token list from CoinGecko...', 'info');
        const fromTokenBtn = document.getElementById('refresh-from-token-btn') as HTMLButtonElement;
        const toTokenBtn = document.getElementById('refresh-to-token-btn') as HTMLButtonElement;
        if (fromTokenBtn) fromTokenBtn.disabled = true;
        if (toTokenBtn) toTokenBtn.disabled = true;

        const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
        const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;

        try {
            const response = await fetch(getCoinGeckoUrl('/coins/list'));
            if (!response.ok) {
                throw new Error(`Failed to fetch token list. Status: ${response.status}`);
            }
            const tokens: { id: string; symbol: string; name: string }[] = await response.json();
            tokenListCache = tokens.sort((a, b) => a.symbol.localeCompare(b.symbol)); // Sort alphabetically
            
            populateTokenDropdowns(tokenListCache);
            logToTerminal(`Successfully fetched and populated ${tokenListCache.length} tokens.`, 'ok');

        } catch (error) {
            logToTerminal(`Error fetching tokens: ${(error as Error).message}`, 'error');
            if (fromTokenSelect) fromTokenSelect.innerHTML = '<option>Error loading tokens</option>';
            if (toTokenSelect) toTokenSelect.innerHTML = '<option>Error loading tokens</option>';
        } finally {
            if (fromTokenBtn) fromTokenBtn.disabled = false;
            if (toTokenBtn) toTokenBtn.disabled = false;
        }
    }

    function populateTokenDropdowns(tokens: { id: string; symbol: string; name: string }[]) {
        const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
        const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;

        if (!fromTokenSelect || !toTokenSelect) return;

        const savedFromToken = localStorage.getItem(FROM_TOKEN_KEY) || 'bitcoin';
        const savedToToken = localStorage.getItem(TO_TOKEN_KEY) || 'ethereum';

        fromTokenSelect.innerHTML = '';
        toTokenSelect.innerHTML = '';
        
        if (tokens.length === 0) {
             fromTokenSelect.innerHTML = '<option>No tokens found</option>';
             toTokenSelect.innerHTML = '<option>No tokens found</option>';
             return;
        }

        tokens.forEach(token => {
            const option = document.createElement('option');
            option.value = token.id;
            option.textContent = `${token.name} (${token.symbol.toUpperCase()})`;
            fromTokenSelect.appendChild(option.cloneNode(true));
            toTokenSelect.appendChild(option);
        });

        if (Array.from(fromTokenSelect.options).some(o => o.value === savedFromToken)) {
            fromTokenSelect.value = savedFromToken;
        }
        if (Array.from(toTokenSelect.options).some(o => o.value === savedToToken)) {
            toTokenSelect.value = savedToToken;
        }
    }
    
    // Listeners for DEX UI
    document.getElementById('refresh-from-token-btn')?.addEventListener('click', fetchAndPopulateTokens);
    document.getElementById('refresh-to-token-btn')?.addEventListener('click', fetchAndPopulateTokens);
    
    document.getElementById('from-token')?.addEventListener('change', (e) => {
        localStorage.setItem(FROM_TOKEN_KEY, (e.target as HTMLSelectElement).value);
    });
    document.getElementById('to-token')?.addEventListener('change', (e) => {
        localStorage.setItem(TO_TOKEN_KEY, (e.target as HTMLSelectElement).value);
    });

    // ===============================================
    // LEVERAGE SLIDER & PERSISTENCE
    // ===============================================
    const leverageSlider = document.getElementById('leverage-slider') as HTMLInputElement;
    const leverageValueEl = document.getElementById('leverage-value') as HTMLElement;
    const leveragePresetBtns = document.querySelectorAll('.leverage-preset-btn');

    function setLeverage(value: string | number, save: boolean = true) {
        if (!leverageSlider || !leverageValueEl) return;
        
        const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
        const clampedValue = Math.max(parseInt(leverageSlider.min, 10), Math.min(parseInt(leverageSlider.max, 10), numericValue));
        
        leverageSlider.value = clampedValue.toString();
        leverageValueEl.textContent = `${clampedValue}x`;

        if (save) {
            localStorage.setItem(LEVERAGE_KEY, clampedValue.toString());
        }
    }
    
    if (leverageSlider) {
        leverageSlider.addEventListener('input', (e) => {
            setLeverage((e.target as HTMLInputElement).value);
        });
    }

    leveragePresetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const value = (e.currentTarget as HTMLElement).dataset.value || '100';
            setLeverage(value);
        });
    });

    function loadLeverage() {
        const savedLeverage = localStorage.getItem(LEVERAGE_KEY);
        if (savedLeverage) {
            setLeverage(savedLeverage, false); // Don't save again on load
        } else {
            // Set default from slider if nothing is saved
             if (leverageSlider) {
                setLeverage(leverageSlider.value, false);
            }
        }
    }

    // ===============================================
    // RECURRING TASKS
    // ===============================================
    const recurringTaskForm = document.getElementById('recurring-task-form') as HTMLFormElement;
    const recurringTaskInput = document.getElementById('recurring-task-input') as HTMLInputElement;
    const recurringTaskSelect = document.getElementById('recurring-task-select') as HTMLSelectElement;
    const recurringTaskList = document.getElementById('recurring-task-list') as HTMLElement;
    let recurringTasks: { id: number; text: string; frequency: string; }[] = [];

    function saveRecurringTasks() {
        localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
    }

    function renderRecurringTask(task: { id: number; text: string; frequency: string; }) {
        const taskElement = document.createElement('div');
        taskElement.className = 'row';
        taskElement.style.justifyContent = 'space-between';
        taskElement.dataset.id = task.id.toString();
        taskElement.innerHTML = `
            <span>${task.text} <span class="tag">${task.frequency}</span></span>
            <button class="delete-task-btn" style="padding: 2px 6px; font-size: .8em;">X</button>
        `;
        taskElement.querySelector('.delete-task-btn')?.addEventListener('click', () => {
            recurringTasks = recurringTasks.filter(t => t.id !== task.id);
            saveRecurringTasks();
            taskElement.remove();
        });
        recurringTaskList.appendChild(taskElement);
    }

    function loadRecurringTasks() {
        const savedTasksJSON = localStorage.getItem(RECURRING_TASKS_KEY);
        if (savedTasksJSON) {
            try {
                const parsedTasks = JSON.parse(savedTasksJSON);
                if (Array.isArray(parsedTasks)) {
                    recurringTasks = parsedTasks;
                } else {
                     throw new Error("Data is not an array");
                }
            } catch (e) {
                logToTerminal('Recurring tasks data in localStorage is corrupted. Resetting.', 'warn');
                localStorage.removeItem(RECURRING_TASKS_KEY);
                recurringTasks = [];
            }
        }
        recurringTaskList.innerHTML = '';
        recurringTasks.forEach(renderRecurringTask);
    }

    recurringTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = recurringTaskInput.value.trim();
        if (text) {
            const newTask = {
                id: Date.now(),
                text,
                frequency: recurringTaskSelect.value,
            };
            recurringTasks.push(newTask);
            saveRecurringTasks();
            renderRecurringTask(newTask);
            recurringTaskInput.value = '';
        }
    });

    // ===============================================
    // KANBAN BOARD
    // ===============================================
    let kanbanTasks: { [key: string]: { id: number, title: string, desc: string }[] } = {
        backlog: [],
        inprogress: [],
        completed: []
    };

    function saveKanbanTasks() {
        localStorage.setItem(KANBAN_TASKS_KEY, JSON.stringify(kanbanTasks));
    }

    function loadKanbanTasks() {
        const savedTasksJSON = localStorage.getItem(KANBAN_TASKS_KEY);
        if (savedTasksJSON) {
            try {
                const parsed = JSON.parse(savedTasksJSON);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
                    Array.isArray(parsed.backlog) && Array.isArray(parsed.inprogress) && Array.isArray(parsed.completed)) {
                    kanbanTasks = parsed;
                } else {
                    throw new Error("Invalid Kanban data structure");
                }
            } catch (e) {
                logToTerminal('Kanban tasks data in localStorage is corrupted. Resetting.', 'warn');
                localStorage.removeItem(KANBAN_TASKS_KEY);
                kanbanTasks = { backlog: [], inprogress: [], completed: [] };
            }
        }
        renderAllKanbanTasks();
    }
    
    function renderKanbanTask(task: { id: number, title: string, desc: string }, status: string) {
        const column = document.querySelector(`.kanban-column[data-status="${status}"] .kanban-tasks`);
        if (!column) return;

        const taskEl = document.createElement('div');
        taskEl.className = 'kanban-task';
        taskEl.dataset.id = task.id.toString();
        taskEl.draggable = true;
        taskEl.innerHTML = `
            <button class="delete-task-btn" data-id="${task.id}" data-status="${status}">X</button>
            <strong>${task.title}</strong>
            <p>${task.desc}</p>
        `;

        taskEl.addEventListener('dragstart', handleDragStart);
        column.appendChild(taskEl);
    }
    
    function renderAllKanbanTasks() {
        document.querySelectorAll('.kanban-tasks').forEach(col => col.innerHTML = '');
        Object.keys(kanbanTasks).forEach(status => {
            kanbanTasks[status].forEach(task => renderKanbanTask(task, status));
        });
        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const id = parseInt(target.dataset.id || '0');
                const status = target.dataset.status || '';
                if(id && status) {
                    kanbanTasks[status] = kanbanTasks[status].filter(t => t.id !== id);
                    saveKanbanTasks();
                    renderAllKanbanTasks();
                }
            });
        });
    }

    document.getElementById('add-task-btn')?.addEventListener('click', () => {
        const titleInput = document.getElementById('new-task-title') as HTMLInputElement;
        const descInput = document.getElementById('new-task-desc') as HTMLTextAreaElement;
        const title = titleInput.value.trim();
        const desc = descInput.value.trim();

        if (title) {
            const newTask = { id: Date.now(), title, desc };
            kanbanTasks.backlog.push(newTask);
            saveKanbanTasks();
            renderAllKanbanTasks();
            titleInput.value = '';
            descInput.value = '';
        }
    });

    // Kanban Drag & Drop
    let draggedItemId: number | null = null;
    let originalStatus: string | null = null;
    
    function handleDragStart(e: DragEvent) {
        const target = e.target as HTMLElement;
        draggedItemId = parseInt(target.dataset.id || '0');
        originalStatus = (target.closest('.kanban-column') as HTMLElement)?.dataset.status || null;
        target.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
    }

    document.querySelectorAll('.kanban-column').forEach(col => {
        col.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            e.dataTransfer!.dropEffect = 'move';
            (e.currentTarget as HTMLElement).classList.add('drag-over');
        });
        col.addEventListener('dragleave', (e: DragEvent) => {
            (e.currentTarget as HTMLElement).classList.remove('drag-over');
        });
        col.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).classList.remove('drag-over');
            const newStatus = (e.currentTarget as HTMLElement).dataset.status;

            if (newStatus && originalStatus && draggedItemId && newStatus !== originalStatus) {
                const taskIndex = kanbanTasks[originalStatus].findIndex(t => t.id === draggedItemId);
                if (taskIndex > -1) {
                    const [task] = kanbanTasks[originalStatus].splice(taskIndex, 1);
                    kanbanTasks[newStatus].push(task);
                    saveKanbanTasks();
                    renderAllKanbanTasks();
                }
            }
            document.querySelector('.kanban-task.dragging')?.classList.remove('dragging');
            draggedItemId = null;
            originalStatus = null;
        });
    });

    // ===============================================
    // DUMMY/MOCK FUNCTIONS
    // ===============================================
    function updateTradeButtonsState() {
      const connected = !!walletAddress;
      const tradeButtons = document.querySelectorAll('.trade-btn, #swap-btn, #ai-signal-btn') as NodeListOf<HTMLButtonElement>;
      tradeButtons.forEach(btn => btn.disabled = !connected);
    }
    
    // ===============================================
    // INITIALIZATION
    // ===============================================
    function initialize() {
      logToTerminal('Initializing NEMODIAN COREMOVEMENT 202X...', 'info');
      loadHudAndTerminalSettings();
      fetchAndPopulateTokens();
      loadLeverage();
      loadRecurringTasks();
      loadKanbanTasks();
      updateTradeButtonsState();
      logToTerminal('System ready.', 'ok');
      $hudStatus.text('Status: Standby');
    }

    initialize();
});