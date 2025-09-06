
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
// Declare marked
declare var marked: any;


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
  color: 0xf78d60,
  backgroundColor: 0x1e2a78,
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
  const OLLAMA_CHAT_HISTORY_KEY = 'ollama_chat_history';
  const COINGECKO_API_KEY = 'coingecko_api_key';
  const OLLAMA_API_URL_KEY = 'ollama_api_url';
  const OLLAMA_MODEL_NAME_KEY = 'ollama_model_name';
  const OLLAMA_TEMPERATURE_KEY = 'ollama_temperature';
  const OLLAMA_MAX_TOKENS_KEY = 'ollama_max_tokens';


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
        prominentButtons.forEach(button => {
            button.classList.toggle('active', button.getAttribute('data-tab') === targetId);
        });
        equalizeCardHeights(); // Re-calculate card height on tab change
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.getAttribute('data-tab')!));
    });

    prominentButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.getAttribute('data-tab')!));
    });
  }


  // Generic Modal
  const modal = document.getElementById('generic-modal')!;
  const modalTitle = document.getElementById('modal-title')!;
  const modalBody = document.getElementById('modal-body')!;
  const modalCloseBtn = modal.querySelector('.modal-close-btn')!;

  function showModal(title: string, content: HTMLElement | string) {
      modalTitle.textContent = title;
      if (typeof content === 'string') {
          modalBody.innerHTML = content;
      } else {
          modalBody.innerHTML = '';
          modalBody.appendChild(content);
      }
      modal.classList.add('active');
  }

  function closeModal() {
      modal.classList.remove('active');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
  });


  // ===============================================
  // WEB3 & WALLET INTEGRATION
  // ===============================================
  const web3Modal = new Web3Modal({
    projectId: '9a8d562a0504b264a858548a80494a86', // Replace with your WalletConnect project ID
    walletConnectVersion: 2
  });

  let provider: ethers.BrowserProvider | null = null;
  let signer: ethers.JsonRpcSigner | null = null;

  const connectWalletBtn = document.getElementById('connectWalletBtn')!;
  const disconnectWalletBtn = document.getElementById('disconnectWalletBtn')!;
  const walletInfoDiv = document.getElementById('walletInfo')!;
  const walletStatusSpan = document.getElementById('walletStatus')!;
  const walletAddressSpan = document.getElementById('walletAddress')!;
  const walletBalanceSpan = document.getElementById('walletBalance')!;

  async function connectWallet() {
    try {
        logToTerminal('Connecting wallet...');
        // FIX: The type definitions for Web3Modal seem to be for a different version, causing a compile-time error.
        // Casting to `any` bypasses the incorrect type definition, assuming `connect` method exists at runtime (as in Web3Modal v1).
        const web3Provider = await (web3Modal as any).connect();
        provider = new ethers.BrowserProvider(web3Provider);
        signer = await provider.getSigner();
        updateWalletUI(true);
        logToTerminal('Wallet connected successfully.', 'ok');
    } catch (error) {
        console.error("Failed to connect wallet:", error);
        logToTerminal('Wallet connection failed or was rejected.', 'error');
        updateWalletUI(false);
    }
  }

  async function disconnectWallet() {
      // Web3Modal v2 doesn't have a simple disconnect. 
      // We can clear our state. User needs to disconnect from wallet extension.
      provider = null;
      signer = null;
      updateWalletUI(false);
      logToTerminal('Disconnected. Please disconnect from your wallet extension.', 'warn');
  }

  async function updateWalletUI(isConnected: boolean) {
      if (isConnected && signer) {
          const address = await signer.getAddress();
          const balance = await provider!.getBalance(address);
          walletStatusSpan.textContent = 'Connected';
          walletAddressSpan.textContent = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
          walletBalanceSpan.textContent = `${ethers.formatEther(balance)} ETH`;

          walletInfoDiv.style.display = 'block';
          connectWalletBtn.style.display = 'none';
      } else {
          walletStatusSpan.textContent = 'Disconnected';
          walletAddressSpan.textContent = 'N/A';
          walletBalanceSpan.textContent = 'N/A';
          
          walletInfoDiv.style.display = 'none';
          connectWalletBtn.style.display = 'block';
      }
  }

  connectWalletBtn.addEventListener('click', connectWallet);
  disconnectWalletBtn.addEventListener('click', disconnectWallet);
  
  // Mnemonic Generator
  const generateMnemonicBtn = document.getElementById('generateMnemonicBtn')!;
  const mnemonicStrengthSelect = document.getElementById('mnemonic-strength') as HTMLSelectElement;
  const mnemonicDisplay = document.getElementById('mnemonic-display')!;

  generateMnemonicBtn.addEventListener('click', () => {
    const strength = parseInt(mnemonicStrengthSelect.value, 10);
    const mnemonic = bip39.generateMnemonic(strength);
    mnemonicDisplay.textContent = mnemonic;
    mnemonicDisplay.style.display = 'block';
    logToTerminal(`Generated new ${strength === 128 ? '12-word' : '24-word'} mnemonic.`);
  });


  // ===============================================
  // DASHBOARD
  // ===============================================

  // TradingView Widget
  function loadTradingViewWidget() {
    new TradingView.widget({
      "container_id": "tradingview-widget-container",
      "autosize": true,
      "symbol": "BITSTAMP:BTCUSD",
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#f1f3f6",
      "enable_publishing": false,
      "allow_symbol_change": true,
    });
    logToTerminal('TradingView widget loaded.', 'ok');
  }

  // Recurring Tasks
  const recurringTasksList = document.getElementById('recurring-tasks-list')!;
  const newRecurringTaskInput = document.getElementById('new-recurring-task') as HTMLInputElement;
  const addRecurringTaskBtn = document.getElementById('add-recurring-task-btn')!;

  let recurringTasks: string[] = JSON.parse(localStorage.getItem(RECURRING_TASKS_KEY) || '[]');

  function renderRecurringTasks() {
    recurringTasksList.innerHTML = '';
    if (recurringTasks.length === 0) {
      recurringTasksList.innerHTML = '<p class="empty-list-msg">No recurring tasks yet.</p>';
      return;
    }
    recurringTasks.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-item';
        taskEl.innerHTML = `
            <span>${task}</span>
            <button class="delete-btn" data-index="${index}">&times;</button>
        `;
        recurringTasksList.appendChild(taskEl);
    });
  }

  addRecurringTaskBtn.addEventListener('click', () => {
    const taskText = newRecurringTaskInput.value.trim();
    if (taskText) {
        recurringTasks.push(taskText);
        localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
        newRecurringTaskInput.value = '';
        renderRecurringTasks();
        logToTerminal(`Added recurring task: "${taskText}"`);
    }
  });

  recurringTasksList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('delete-btn')) {
        const index = parseInt(target.getAttribute('data-index')!, 10);
        const removedTask = recurringTasks.splice(index, 1)[0];
        localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
        renderRecurringTasks();
        logToTerminal(`Removed recurring task: "${removedTask}"`, 'warn');
    }
  });


  // ===============================================
  // DEX TOOLS
  // ===============================================
  const fromTokenInput = document.getElementById('from-token') as HTMLInputElement;
  const toTokenInput = document.getElementById('to-token') as HTMLInputElement;
  const leverageSelect = document.getElementById('leverage') as HTMLSelectElement;
  const swapBtn = document.getElementById('swap-btn')!;

  function saveDexSettings() {
    localStorage.setItem(FROM_TOKEN_KEY, fromTokenInput.value);
    localStorage