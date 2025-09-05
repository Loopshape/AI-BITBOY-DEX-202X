
import { GoogleGenAI, Type } from "@google/genai";

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
const consoleElement = document.getElementById('console');
function logToConsole(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span class="log-info">[${timestamp}]</span> <span class="log-${type}">${message}</span>`;
  consoleElement.appendChild(logEntry);
  consoleElement.scrollTop = consoleElement.scrollHeight; // Auto-scroll
}

document.addEventListener('DOMContentLoaded', () => {

  // ===============================================
  // COINGECKO API INTEGRATION
  // ===============================================
  const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

  async function fetchCoinGeckoTrending() {
    const hotPairsList = document.getElementById('hot-pairs-list');
    try {
      const response = await fetch(`${COINGECKO_API_BASE}/search/trending`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      hotPairsList.innerHTML = ''; // Clear loader
      data.coins.slice(0, 7).forEach(coin => {
        const pairEl = document.createElement('div');
        pairEl.className = 'dex-pair';
        pairEl.innerHTML = `
          <div class="row">
            <div class="dex-pair-logos">
              <img src="${coin.item.small}" alt="${coin.item.name}">
            </div>
            <span class="mono">${coin.item.symbol}/USD</span>
          </div>
          <span class="mono">Rank: ${coin.item.market_cap_rank}</span>
        `;
        hotPairsList.appendChild(pairEl);
      });
      logToConsole('Loaded trending pairs from CoinGecko.', 'ok');
    } catch (error) {
      logToConsole(`Failed to fetch CoinGecko trending data: ${error.message}`, 'error');
      hotPairsList.innerHTML = '<p class="small log-error">Could not load trending pairs.</p>';
    }
  }

  async function populateTokenSelects() {
    const fromTokenSelect = document.getElementById('from-token');
    const toTokenSelect = document.getElementById('to-token');
    
    try {
      const response = await fetch(`${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      fromTokenSelect.innerHTML = '';
      toTokenSelect.innerHTML = '';

      // Add custom BITBOY token
      const bitboyOption = new Option('BITBOY (BITBOY)', 'BITBOY');
      fromTokenSelect.add(bitboyOption.cloneNode(true));
      toTokenSelect.add(bitboyOption);

      data.forEach(coin => {
        const option = new Option(`${coin.name} (${coin.symbol.toUpperCase()})`, coin.id);
        fromTokenSelect.add(option.cloneNode(true));
        toTokenSelect.add(option);
      });

      // Set default values
      fromTokenSelect.value = 'ethereum';
      toTokenSelect.value = 'BITBOY';
      
      logToConsole('Loaded top 50 tokens from CoinGecko.', 'ok');

    } catch (error) {
      logToConsole(`Failed to fetch CoinGecko market data: ${error.message}`, 'error');
      fromTokenSelect.innerHTML = '<option>Error loading tokens</option>';
      toTokenSelect.innerHTML = '<option>Error loading tokens</option>';
    }
  }

  // ===============================================
  // GEMINI AI CORE
  // ===============================================
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const aiPromptInput = document.getElementById('ollama-prompt');
  const aiSubmitBtn = document.getElementById('ollama-submit');

  async function queryAiCore(prompt) {
    logToConsole(`Querying Gemini AI Core...`, 'info');
    aiSubmitBtn.disabled = true;
    aiSubmitBtn.textContent = 'Thinking...';
    try {
        const result = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        const responseContent = document.createElement('span');
        logEntry.innerHTML = `<span class="log-info">[${timestamp}]</span> <span class="log-ok">AI Response: </span>`;
        logEntry.appendChild(responseContent);
        consoleElement.appendChild(logEntry);

        for await (const chunk of result) {
            const chunkText = chunk.text;
            responseContent.innerHTML += chunkText.replace(/\n/g, '<br>');
            consoleElement.scrollTop = consoleElement.scrollHeight;
        }
    } catch (error) {
      logToConsole(`Error querying Gemini: ${error.message}`, 'error');
    } finally {
        aiSubmitBtn.disabled = false;
        aiSubmitBtn.textContent = 'Query AI Core';
    }
  }

  aiSubmitBtn.addEventListener('click', () => {
    const promptText = aiPromptInput.value.trim();
    if (promptText) {
      queryAiCore(promptText);
    } else {
      logToConsole('Prompt cannot be empty.', 'warn');
    }
  });


  // ===============================================
  // GENERIC TAB HANDLER
  // ===============================================
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    tabGroup.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabId = e.target.dataset.tab;
        
        tabGroup.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        const contentContainer = e.target.closest('.card');
        contentContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
      }
    });
  });

  // ===============================================
  // BITBOY AI-DEX LOGIC
  // ===============================================
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  const disconnectWalletBtn = document.getElementById('disconnect-wallet-btn');
  const swapBtn = document.getElementById('swap-btn');
  const aiSignalBtn = document.getElementById('ai-signal-btn');
  let userAccount = null;

  function getNetworkName(chainId) {
    switch (chainId) {
      case '0x1': return 'Ethereum Mainnet';
      case '0xaa36a7': return 'Sepolia';
      case '0x89': return 'Polygon Mainnet';
      default: return `Unknown (${chainId})`;
    }
  }

  async function updateWalletInfo() {
    if (!userAccount || typeof window.ethereum === 'undefined') return;

    try {
      const weiBalance = await window.ethereum.request({ method: 'eth_getBalance', params: [userAccount, 'latest'] });
      const ethBalance = (parseInt(weiBalance, 16) / 1e18).toFixed(4);
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const networkName = getNetworkName(chainId);

      document.getElementById('wallet-address').textContent = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
      document.getElementById('wallet-balance').textContent = ethBalance;
      document.getElementById('wallet-network').textContent = networkName;
      document.getElementById('wallet-info').style.display = 'block';

    } catch (error) {
        logToConsole(`Could not fetch wallet info: ${error.message}`, 'error');
    }
  }


  connectWalletBtn.addEventListener('click', async () => {
    if (typeof window.ethereum === 'undefined') {
      logToConsole('MetaMask is not installed. Please install a Web3 wallet.', 'error');
      return;
    }

    try {
      logToConsole('Requesting wallet connection...', 'info');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      userAccount = accounts[0];
      
      await updateWalletInfo();
      
      connectWalletBtn.style.display = 'none';
      disconnectWalletBtn.style.display = 'inline-block';
      swapBtn.disabled = false;
      aiSignalBtn.disabled = false;
      logToConsole(`Wallet connected: ${userAccount}`, 'ok');
    } catch (error) {
      logToConsole(`Wallet connection failed: ${error.message}`, 'error');
    }
  });

  disconnectWalletBtn.addEventListener('click', () => {
    userAccount = null;
    document.getElementById('wallet-info').style.display = 'none';
    connectWalletBtn.style.display = 'inline-block';
    disconnectWalletBtn.style.display = 'none';
    swapBtn.disabled = true;
    aiSignalBtn.disabled = true;
    logToConsole('Wallet disconnected.', 'info');
  });
  
  if (typeof window.ethereum !== 'undefined') {
    window.ethereum.on('accountsChanged', (accounts) => {
      if (accounts.length > 0) {
        if(userAccount !== accounts[0]){
          logToConsole('Account switched. Updating info...', 'info');
          userAccount = accounts[0];
          updateWalletInfo();
        }
      } else {
        logToConsole('Wallet disconnected by user.', 'warn');
        disconnectWalletBtn.click();
      }
    });

    window.ethereum.on('chainChanged', async (chainId) => {
      if (userAccount) {
        logToConsole(`Network changed to ${getNetworkName(chainId)}.`, 'info');
        await updateWalletInfo();
      }
    });
  }


  const fromAmountInput = document.getElementById('from-amount');
  const toAmountInput = document.getElementById('to-amount');
  const fromTokenSelect = document.getElementById('from-token');
  const toTokenSelect = document.getElementById('to-token');

  // Fixed rates for the custom token for simulation
  const bitboyRates = { 'ethereum': 5000, 'usd-coin': 3.33 }; 

  async function getDynamicRate(fromId, toId) {
    if (fromId === toId) return 1;
    if (fromId === 'BITBOY') return 1 / bitboyRates[toId];
    if (toId === 'BITBOY') return bitboyRates[fromId];

    try {
      const response = await fetch(`${COINGECKO_API_BASE}/simple/price?ids=${fromId}&vs_currencies=${toId}`);
      if (!response.ok) throw new Error('Failed to fetch rate from API');
      const data = await response.json();
      return data[fromId][toId];
    } catch (error) {
      logToConsole(`Could not fetch dynamic rate for ${fromId}/${toId}: ${error.message}`, 'error');
      return 0; // Return 0 on error
    }
  }
  
  async function updateSwapAmounts() {
    const fromId = fromTokenSelect.value;
    const toId = toTokenSelect.value;
    const fromAmount = parseFloat(fromAmountInput.value);

    if (!fromId || !toId || !fromAmount || fromAmount <= 0) {
      toAmountInput.value = '';
      return;
    }

    const rate = await getDynamicRate(fromId, toId);
    if (rate) {
      toAmountInput.value = (fromAmount * rate).toFixed(6);
    } else {
      toAmountInput.value = 'Rate unavailable';
    }
  }

  [fromAmountInput, fromTokenSelect, toTokenSelect].forEach(el => {
    el.addEventListener('input', updateSwapAmounts);
    el.addEventListener('change', updateSwapAmounts);
  });

  swapBtn.addEventListener('click', () => {
    const fromToken = fromTokenSelect.options[fromTokenSelect.selectedIndex].text;
    const toToken = toTokenSelect.options[toTokenSelect.selectedIndex].text;
    const fromAmount = fromAmountInput.value;
    const toAmount = toAmountInput.value;

    if (!fromAmount || parseFloat(fromAmount) <= 0) {
        logToConsole('Invalid amount for swap.', 'warn');
        return;
    }

    logToConsole(`Initiating swap of ${fromAmount} ${fromToken} for ${toAmount} ${toToken}...`, 'info');
    swapBtn.disabled = true;
    swapBtn.textContent = 'Submitting...';

    // Realistic transaction simulation
    setTimeout(() => {
        logToConsole('Transaction submitted. Waiting for confirmation...', 'info');
        swapBtn.textContent = 'Confirming (0/3)...';
        let confirmations = 0;
        const interval = setInterval(() => {
            confirmations++;
            swapBtn.textContent = `Confirming (${confirmations}/3)...`;
            logToConsole(`Block confirmation ${confirmations}/3...`, 'info');
            if (confirmations >= 3) {
                clearInterval(interval);
                const txHash = `0x${[...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
                logToConsole(`Swap successful! TxHash: ${txHash}`, 'ok');
                swapBtn.disabled = false;
                swapBtn.textContent = 'Swap';
                fromAmountInput.value = '';
                toAmountInput.value = '';
                updateWalletInfo(); // Refresh balance
            }
        }, 2500);
    }, 1500);
  });
  
  aiSignalBtn.addEventListener('click', () => {
      const fromToken = fromTokenSelect.options[fromTokenSelect.selectedIndex].text;
      const toToken = toTokenSelect.options[toTokenSelect.selectedIndex].text;
      const prompt = `Provide a brief, speculative trade signal analysis for swapping ${fromToken} for ${toToken} right now. Consider current market conditions. Be concise.`;
      queryAiCore(prompt);
  });

  // ===============================================
  // CRYPTOGRAPHIC OPERATIONS
  // ===============================================
  const hashInput = document.getElementById('hash-input');
  const hashBtn = document.getElementById('hash-btn');
  const hashOutput = document.getElementById('hash-output');

  hashBtn.addEventListener('click', async () => {
    const text = hashInput.value;
    if (!text) {
        logToConsole('Hash input is empty.', 'warn');
        return;
    }
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        hashOutput.textContent = hashHex;
        hashOutput.style.display = 'block';
        logToConsole('SHA-256 hash generated.', 'ok');
    } catch (error) {
        logToConsole(`Hashing failed: ${error.message}`, 'error');
    }
  });

  const aesInput = document.getElementById('aes-input');
  const aesPassword = document.getElementById('aes-password');
  const aesEncryptBtn = document.getElementById('aes-encrypt-btn');
  const aesDecryptBtn = document.getElementById('aes-decrypt-btn');
  const aesOutput = document.getElementById('aes-output');

  async function getAesKey(password, salt) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
          'raw',
          enc.encode(password),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
      );
      return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
      );
  }

  aesEncryptBtn.addEventListener('click', async () => {
    const plaintext = aesInput.value;
    const password = aesPassword.value;
    if (!plaintext || !password) {
        logToConsole('AES Encryption: Plaintext and password are required.', 'warn');
        return;
    }
    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await getAesKey(password, salt);
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(plaintext)
        );
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        combined.set(salt);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);
        
        const base64String = btoa(String.fromCharCode.apply(null, combined));
        aesOutput.textContent = base64String;
        aesOutput.style.display = 'block';
        logToConsole('AES-GCM encryption successful.', 'ok');
    } catch (error) {
        logToConsole(`AES encryption failed: ${error.message}`, 'error');
    }
  });

  aesDecryptBtn.addEventListener('click', async () => {
    const ciphertextB64 = aesInput.value;
    const password = aesPassword.value;
    if (!ciphertextB64 || !password) {
        logToConsole('AES Decryption: Ciphertext and password are required.', 'warn');
        return;
    }
    try {
        const combined = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const ciphertext = combined.slice(28);

        const key = await getAesKey(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ciphertext
        );
        const plaintext = new TextDecoder().decode(decrypted);
        aesOutput.textContent = `DECRYPTED: ${plaintext}`;
        aesOutput.style.display = 'block';
        logToConsole('AES-GCM decryption successful.', 'ok');
    } catch (error) {
        logToConsole(`AES decryption failed: ${error.message}. Check password or ciphertext.`, 'error');
    }
  });


  // ===============================================
  // SYSTEM TAB
  // ===============================================
  const checkApiBtn = document.getElementById('check-api-btn');
  const apiStatus = document.getElementById('api-status');
  const clearDataBtn = document.getElementById('clear-data-btn');
  
  checkApiBtn.addEventListener('click', async () => {
    apiStatus.textContent = 'Pinging...';
    try {
        const response = await fetch(`${COINGECKO_API_BASE}/ping`);
        if (!response.ok) throw new Error(`HTTP Status ${response.status}`);
        const data = await response.json();
        if (data.gecko_says) {
             apiStatus.textContent = 'Status: OK';
             apiStatus.style.color = 'var(--color-neon-green)';
             logToConsole('CoinGecko API status: OK', 'ok');
        }
    } catch (error) {
        apiStatus.textContent = `Status: Error - ${error.message}`;
        apiStatus.style.color = 'var(--color-neon-red)';
        logToConsole(`CoinGecko API status check failed: ${error.message}`, 'error');
    }
  });

  clearDataBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all recurring tasks? This cannot be undone.')) {
        localStorage.removeItem(RECURRING_TASKS_KEY);
        recurringTasks = [];
        renderRecurringTasks();
        logToConsole('All local data has been cleared.', 'warn');
    }
  });


  // ===============================================
  // RECURRING TASKS
  // ===============================================
  const RECURRING_TASKS_KEY = 'bitboy_ai_dex_tasks';
  const taskForm = document.getElementById('recurring-task-form');
  const taskInput = document.getElementById('recurring-task-input');
  const taskSelect = document.getElementById('recurring-task-select');
  const taskList = document.getElementById('recurring-task-list');
  let recurringTasks = [];

  function saveRecurringTasks() {
      localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
  }

  function renderRecurringTasks() {
      taskList.innerHTML = '';
      if (recurringTasks.length === 0) {
          taskList.innerHTML = '<p class="small">No recurring tasks yet.</p>';
          return;
      }
      recurringTasks.forEach((task, index) => {
          const taskEl = document.createElement('div');
          taskEl.className = 'dex-pair'; // Re-using style for consistency
          taskEl.innerHTML = `
              <div class="row">
                  <span class="tag mono">${task.frequency}</span>
                  <span>${task.text}</span>
              </div>
              <button class="delete-task-btn" data-index="${index}">&times;</button>
          `;
          taskList.appendChild(taskEl);
      });
  }
  
  taskList.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-task-btn')) {
          const index = parseInt(e.target.dataset.index, 10);
          recurringTasks.splice(index, 1);
          saveRecurringTasks();
          renderRecurringTasks();
          logToConsole('Recurring task removed.', 'info');
      }
  });

  taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = taskInput.value.trim();
      const frequency = taskSelect.value;
      if (text) {
          recurringTasks.push({ text, frequency });
          saveRecurringTasks();
          renderRecurringTasks();
          taskInput.value = '';
          logToConsole('New recurring task added.', 'ok');
      }
  });

  function loadRecurringTasks() {
      const storedTasks = localStorage.getItem(RECURRING_TASKS_KEY);
      if (storedTasks) {
          recurringTasks = JSON.parse(storedTasks);
      }
      renderRecurringTasks();
  }

  // ===============================================
  // INITIALIZATION
  // ===============================================
  logToConsole('UI Initialized. Welcome to BITBOY AI::DEX.', 'ok');
  fetchCoinGeckoTrending();
  populateTokenSelects();
  loadRecurringTasks();

});
