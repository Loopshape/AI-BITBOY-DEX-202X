
import * as bip39 from 'bip39';
import { Web3Modal } from '@web3modal/standalone';


// Fix: Declare VANTA to make it available in TypeScript
declare var VANTA: any;
// Declare TradingView for the widget
declare var TradingView: any;


// Fix: Extend Window interface for MetaMask/Web3 wallet compatibility
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
// Fix: Cast consoleElement to HTMLElement
const consoleElement = document.getElementById('console') as HTMLElement;
function logToConsole(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span class="log-info">[${timestamp}]</span> <span class="log-${type}">${message}</span>`;
  consoleElement.appendChild(logEntry);
  consoleElement.scrollTop = consoleElement.scrollHeight; // Auto-scroll
}

document.addEventListener('DOMContentLoaded', () => {

  // Fix: Moved constant declaration before its first use to prevent runtime errors.
  const RECURRING_TASKS_KEY = 'bitboy_ai_dex_tasks';
  const KANBAN_TASKS_KEY = 'nemodian_kanban_tasks';

  
  // ===============================================
  // TRADINGVIEW WIDGET
  // ===============================================
  function updateTradingViewWidget(symbol = 'BINANCE:BTCUSD') {
    const container = document.getElementById('tradingview-widget-container');
    if (!container || typeof TradingView === 'undefined') return;

    // Clear previous widget
    container.innerHTML = '';

    try {
        new TradingView.widget({
            "autosize": true,
            "symbol": symbol,
            "interval": "240", // 4 hours
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "enable_publishing": false,
            "allow_symbol_change": true,
            "container_id": "tradingview-widget-container"
        });
        logToConsole(`TradingView chart loaded for ${symbol}.`, 'info');
    } catch (error) {
        logToConsole(`Failed to load TradingView widget: ${error.message}`, 'error');
        container.innerHTML = '<p class="small log-error">Could not load chart.</p>';
    }
  }


  // ===============================================
  // COINGECKO API INTEGRATION
  // ===============================================
  const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

  async function fetchCoinGeckoTrending() {
    // Fix: Cast hotPairsList to HTMLElement
    const hotPairsList = document.getElementById('hot-pairs-list') as HTMLElement;
    try {
      const response = await fetch(`${COINGECKO_API_BASE}/search/trending`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      hotPairsList.innerHTML = ''; // Clear loader
      data.coins.slice(0, 7).forEach(coin => {
        const pairEl = document.createElement('div');
        pairEl.className = 'dex-pair';
        pairEl.style.cursor = 'pointer'; // Make it look clickable
        pairEl.innerHTML = `
          <div class="row">
            <div class="dex-pair-logos">
              <img src="${coin.item.small}" alt="${coin.item.name}">
            </div>
            <span class="mono">${coin.item.symbol}/USD</span>
          </div>
          <span class="mono">Rank: ${coin.item.market_cap_rank}</span>
        `;
        // Add event listener to pre-fill AI prompt on click
        pairEl.addEventListener('click', () => {
            setAiPromptForToken(coin.item.name, coin.item.symbol, coin.item.id);
        });
        hotPairsList.appendChild(pairEl);
      });
      logToConsole('Loaded trending pairs from CoinGecko.', 'ok');
    } catch (error) {
      logToConsole(`Failed to fetch CoinGecko trending data: ${error.message}`, 'error');
      hotPairsList.innerHTML = '<p class="small log-error">Could not load trending pairs.</p>';
    }
  }

  async function populateTokenSelects() {
    // Fix: Cast select elements to HTMLSelectElement to access properties like 'add' and 'value'.
    const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
    const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;
    
    try {
      const response = await fetch(`${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      fromTokenSelect.innerHTML = '';
      toTokenSelect.innerHTML = '';

      // Add custom BITBOY token
      const bitboyOption = new Option('BITBOY (BITBOY)', 'BITBOY');
      fromTokenSelect.add(bitboyOption.cloneNode(true) as HTMLOptionElement);
      toTokenSelect.add(bitboyOption);

      data.forEach(coin => {
        const option = new Option(`${coin.name} (${coin.symbol.toUpperCase()})`, coin.id);
        fromTokenSelect.add(option.cloneNode(true) as HTMLOptionElement);
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
  // OLLAMA AI CORE
  // ===============================================
  const aiPromptInput = document.getElementById('ollama-prompt') as HTMLInputElement;
  const aiSubmitBtn = document.getElementById('ollama-submit') as HTMLButtonElement;
  const suggestPromptsBtn = document.getElementById('suggest-prompts-btn') as HTMLButtonElement;
  const promptSuggestionsContainer = document.getElementById('prompt-suggestions') as HTMLElement;

  let aiSettings = {
    apiUrl: 'http://localhost:11434',
    model: 'llama3'
  };
  const SETTINGS_COOKIE_KEY = "-1";

  function saveSettingsToCookie() {
      try {
          document.cookie = `${SETTINGS_COOKIE_KEY}=${encodeURIComponent(JSON.stringify(aiSettings))};path=/;max-age=31536000`; // Expires in 1 year
          logToConsole('AI settings saved.', 'ok');
      } catch (e) {
          logToConsole(`Failed to save settings: ${e.message}`, 'error');
      }
  }
  
  function loadSettingsFromCookie() {
      const apiUrlInput = document.getElementById('ollama-api-url') as HTMLInputElement;
      const modelNameInput = document.getElementById('ollama-model-name') as HTMLInputElement;
      
      try {
          const cookieValue = document.cookie
              .split('; ')
              .find(row => row.startsWith(`${SETTINGS_COOKIE_KEY}=`))
              ?.split('=')[1];

          if (cookieValue) {
              aiSettings = JSON.parse(decodeURIComponent(cookieValue));
              logToConsole('Loaded AI settings from cookie.', 'info');
          } else {
              // Save default settings if no cookie is found
              saveSettingsToCookie();
          }
          
          if (apiUrlInput) apiUrlInput.value = aiSettings.apiUrl;
          if (modelNameInput) modelNameInput.value = aiSettings.model;

      } catch (e) {
          logToConsole(`Failed to load settings, using defaults: ${e.message}`, 'warn');
          if (apiUrlInput) apiUrlInput.value = aiSettings.apiUrl;
          if (modelNameInput) modelNameInput.value = aiSettings.model;
      }
  }

  document.getElementById('save-settings-btn')?.addEventListener('click', () => {
      const apiUrlInput = document.getElementById('ollama-api-url') as HTMLInputElement;
      const modelNameInput = document.getElementById('ollama-model-name') as HTMLInputElement;
      aiSettings.apiUrl = apiUrlInput.value.trim();
      aiSettings.model = modelNameInput.value.trim();
      saveSettingsToCookie();
  });


  // Function to pre-fill the AI prompt based on a selected token
  async function setAiPromptForToken(tokenName, tokenSymbol, tokenId) {
    let prompt = `Provide a detailed market analysis for ${tokenName} (${tokenSymbol.toUpperCase()}). What are the recent trends, potential price targets, and overall market sentiment?`;

    // Fetch price to add context, but don't for the custom token
    if (tokenId && tokenId.toUpperCase() !== 'BITBOY') {
      try {
        logToConsole(`Fetching market data for ${tokenName}...`, 'info');
        
        const [priceResponse, chartResponse] = await Promise.all([
            fetch(`${COINGECKO_API_BASE}/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`),
            fetch(`${COINGECKO_API_BASE}/coins/${tokenId}/market_chart?vs_currency=usd&days=7&interval=daily`)
        ]);

        if (!priceResponse.ok) throw new Error(`Price fetch failed: ${priceResponse.statusText}`);
        if (!chartResponse.ok) throw new Error(`Chart fetch failed: ${chartResponse.statusText}`);
        
        const priceData = await priceResponse.json();
        const chartData = await chartResponse.json();

        const currentPriceData = priceData[tokenId];
        const prices = chartData.prices;

        if (currentPriceData && currentPriceData.usd !== undefined) {
          const price = currentPriceData.usd;
          const change = currentPriceData.usd_24h_change || 0;
          let trendText = "";

          if (prices && prices.length > 1) {
              const startPrice = prices[0][1];
              // Use live price for more accuracy vs last daily close from chart data
              const endPrice = price; 
              const sevenDayChange = ((endPrice - startPrice) / startPrice) * 100;
              trendText = ` Over the past week, its price has changed by approximately ${sevenDayChange.toFixed(2)}%.`;
              logToConsole(`7-day trend for ${tokenName}: ${sevenDayChange.toFixed(2)}%`, 'info');
          }

          logToConsole(`Current ${tokenName} price: $${price.toFixed(2)} (24h: ${change.toFixed(2)}%)`, 'info');

          prompt = `Provide a detailed market analysis for ${tokenName} (${tokenSymbol.toUpperCase()}). Its current price is approximately $${price.toFixed(2)} USD, with a 24-hour change of ${change.toFixed(2)}%.${trendText} Based on this data, what are the recent trends, potential price targets, and overall market sentiment?`;

        } else {
            logToConsole(`Could not find price data for ${tokenName}. Using generic prompt.`, 'warn');
        }
      } catch (error) {
        logToConsole(`Failed to fetch market data for ${tokenName}: ${error.message}`, 'error');
        // Fallback to the generic prompt if API call fails
      }
    }
    
    aiPromptInput.value = prompt;
    logToConsole(`AI prompt pre-filled for ${tokenName}.`, 'info');
    
    // Scroll to the AI core and focus the input for better UX
    const aiCoreCard = aiPromptInput.closest('.card');
    if (aiCoreCard) {
        aiCoreCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    aiPromptInput.focus();

    // Update the TradingView widget, ignoring the custom token
    if (tokenSymbol.toUpperCase() !== 'BITBOY') {
      // Using Binance for better token pair availability
      updateTradingViewWidget(`BINANCE:${tokenSymbol.toUpperCase()}USD`);
    }
  }

  async function queryAiCore(prompt: string, isJsonMode = false) {
    if (!aiSettings.apiUrl || !aiSettings.model) {
        logToConsole('Ollama API URL or model is not configured. Please check System settings.', 'error');
        return null;
    }
    logToConsole(`Querying local Ollama AI Core (${aiSettings.model})...`, 'info');
    aiSubmitBtn.disabled = true;
    aiSubmitBtn.textContent = 'Thinking...';
    aiSignalBtn.disabled = true;

    try {
        const response = await fetch(`${aiSettings.apiUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: aiSettings.model,
                prompt: prompt,
                format: isJsonMode ? 'json' : undefined,
                stream: !isJsonMode
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ollama API error (${response.status}): ${errorText}`);
        }

        // Handle streaming response
        if (!isJsonMode && response.body) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            const responseContent = document.createElement('span');
            logEntry.innerHTML = `<span class="log-info">[${timestamp}]</span> <span class="log-ok">AI Response: </span>`;
            logEntry.appendChild(responseContent);
            consoleElement.appendChild(logEntry);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep the last, possibly incomplete line
                
                lines.forEach(line => {
                    if (line.trim()) {
                        try {
                            const chunk = JSON.parse(line);
                            if (chunk.response) {
                                responseContent.innerHTML += chunk.response.replace(/\n/g, '<br>');
                                consoleElement.scrollTop = consoleElement.scrollHeight;
                            }
                        } catch (e) {
                           console.warn('Could not parse streaming chunk:', line);
                        }
                    }
                });
            }
            return "Streaming complete."; // Signal success for streaming.
        } 
        // Handle non-streaming JSON response
        else {
            const result = await response.json();
            // Ollama non-streaming with format:json wraps the response.
            return JSON.parse(result.response);
        }

    } catch (error) {
        logToConsole(`Error querying Ollama: ${error.message}. Is it running at ${aiSettings.apiUrl}?`, 'error');
        return null;
    } finally {
        aiSubmitBtn.disabled = false;
        aiSubmitBtn.textContent = 'Query AI Core';
        if (userAccount) {
            aiSignalBtn.disabled = false;
        }
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
  
  async function getPromptSuggestions() {
    logToConsole('Generating prompt suggestions...', 'info');
    suggestPromptsBtn.disabled = true;
    suggestPromptsBtn.textContent = 'Generating...';
    promptSuggestionsContainer.innerHTML = '';

    try {
      const prompt = `
        You are an expert crypto market analyst integrated into a DEX application. 
        Generate exactly 3 concise, insightful questions a user might ask about the current cryptocurrency market.
        The questions will be used as suggested prompts for an AI.
        The prompts should be distinct and cover different aspects like market sentiment, specific asset analysis, and future trends.
        Return ONLY a single, raw, valid JSON array of strings. Do not include any other text, explanations, or markdown formatting.
        Example: ["What is the current market sentiment?", "Analyze Bitcoin's recent price action.", "What are the top 3 altcoins to watch this month?"]
      `;
      
      const suggestions = await queryAiCore(prompt, true);

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        logToConsole('Generated prompt suggestions.', 'ok');
        suggestions.forEach(suggestionText => {
          const suggestionEl = document.createElement('div');
          suggestionEl.className = 'prompt-suggestion mono';
          suggestionEl.textContent = suggestionText;
          suggestionEl.addEventListener('click', () => {
            aiPromptInput.value = suggestionText;
            logToConsole(`Prompt set to: "${suggestionText}"`, 'info');
            aiPromptInput.focus();
          });
          promptSuggestionsContainer.appendChild(suggestionEl);
        });
      } else {
          throw new Error('Received invalid suggestions format from AI.');
      }

    } catch (error) {
      logToConsole(`Failed to get prompt suggestions: ${error.message}`, 'error');
    } finally {
      suggestPromptsBtn.disabled = false;
      suggestPromptsBtn.textContent = 'Suggest Prompts';
    }
  }

  suggestPromptsBtn.addEventListener('click', getPromptSuggestions);


  // ===============================================
  // GENERIC TAB HANDLER
  // ===============================================
  function activateTab(tabId) {
    if (!tabId) return;
    
    const mainCard = document.getElementById('main-card');
    if(mainCard) {
        mainCard.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        });
        mainCard.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }
  }

  document.querySelectorAll('.tabs').forEach(tabGroup => {
    tabGroup.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('tab-button')) {
        activateTab(target.dataset.tab);
      }
    });
  });
  
  document.querySelectorAll('.prominent-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const targetTab = (e.currentTarget as HTMLElement).dataset.tabTarget;
        if (targetTab) {
            activateTab(targetTab);
            // Scroll to the main card for visibility
            document.getElementById('main-card')?.scrollIntoView({ behavior: 'smooth' });
        }
    });
  });


  // ===============================================
  // BITBOY AI-DEX LOGIC
  // ===============================================
  const headerConnectBtn = document.getElementById('header-connect-btn') as HTMLButtonElement;
  const headerDisconnectBtn = document.getElementById('header-disconnect-btn') as HTMLButtonElement;
  const walletStatusIndicator = document.getElementById('wallet-status-indicator') as HTMLElement;
  const headerWalletInfo = document.getElementById('header-wallet-info') as HTMLElement;
  const headerWalletAddress = document.getElementById('header-wallet-address') as HTMLElement;
  const headerWalletNetwork = document.getElementById('header-wallet-network') as HTMLElement;
  const headerWalletBalance = document.getElementById('header-wallet-balance') as HTMLElement;
  const swapBtn = document.getElementById('swap-btn') as HTMLButtonElement;
  const aiSignalBtn = document.getElementById('ai-signal-btn') as HTMLButtonElement;
  const buyLongBtn = document.getElementById('buy-long-btn') as HTMLButtonElement;
  const sellShortBtn = document.getElementById('sell-short-btn') as HTMLButtonElement;
  const leverageSlider = document.getElementById('leverage-slider') as HTMLInputElement;
  const leverageValue = document.getElementById('leverage-value') as HTMLSpanElement;
  const leveragePresetsContainer = document.getElementById('leverage-presets') as HTMLElement;


  let userAccount = null;
  let provider = null; // To hold the active wallet provider (MetaMask or WC)
  let walletUpdateInterval: number | null = null;


  // WalletConnect Modal
    const web3Modal = new Web3Modal({
      // IMPORTANT: Replace with your own WalletConnect Cloud project ID
      projectId: '4a0b3694be05a0657c0b7880916388bc', // Using a generic public one for demo purposes
  });
  
  const connectModal = document.getElementById('connect-modal') as HTMLElement;
  const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
  const connectMetaMaskBtn = document.getElementById('connect-metamask-btn') as HTMLButtonElement;
  const connectWalletConnectBtn = document.getElementById('connect-walletconnect-btn') as HTMLButtonElement;

  function openConnectModal() {
      connectModal.style.display = 'flex';
  }
  function closeConnectModal() {
      connectModal.style.display = 'none';
  }
  headerConnectBtn.addEventListener('click', openConnectModal);
  closeModalBtn.addEventListener('click', closeConnectModal);
  connectModal.addEventListener('click', (e) => {
      if (e.target === connectModal) {
          closeConnectModal();
      }
  });


  function getNetworkName(chainId) {
    switch (chainId) {
      case '0x1': return 'Ethereum';
      case '0xaa36a7': return 'Sepolia';
      case '0x89': return 'Polygon';
      default: return `Unknown (${chainId})`;
    }
  }

  async function updateWalletDisplay(connectedProvider) {
    if (!userAccount || !connectedProvider) return;
    try {
        const [chainId, balanceWei] = await Promise.all([
            connectedProvider.request({ method: 'eth_chainId' }),
            connectedProvider.request({ method: 'eth_getBalance', params: [userAccount, 'latest'] })
        ]);

        const networkName = getNetworkName(chainId);
        const balanceEth = (parseInt(balanceWei, 16) / 1e18).toFixed(4);
        
        headerWalletAddress.textContent = `${userAccount.slice(0, 6)}...${userAccount.slice(-4)}`;
        headerWalletNetwork.textContent = networkName;
        headerWalletBalance.textContent = `${balanceEth} ETH`;
        
        headerWalletInfo.style.display = 'flex';
        walletStatusIndicator.className = 'status-dot connected';

    } catch (error) {
        logToConsole(`Could not refresh wallet state: ${error.message}`, 'error');
        // Don't disconnect on a failed refresh, as the connection may still be valid.
        // The 'disconnect' event listener will handle actual disconnections.
    }
  }

  async function onConnect(connectedProvider) {
      provider = connectedProvider;
      
      // Subscribe to events
      provider.on('accountsChanged', (accounts) => {
          if (accounts.length > 0) {
              userAccount = accounts[0];
              logToConsole(`Account switched to: ${userAccount}`, 'info');
              updateWalletDisplay(provider);
          } else {
              disconnect();
          }
      });
      provider.on('chainChanged', () => {
          logToConsole('Network changed. Refreshing wallet state.', 'info');
          updateWalletDisplay(provider);
      });
      provider.on('disconnect', () => {
          disconnect();
      });

      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        if(accounts && accounts.length > 0) {
            userAccount = accounts[0];

            // --- One-time setup on successful connection ---
            headerConnectBtn.style.display = 'none';
            headerDisconnectBtn.style.display = 'inline-block';
            swapBtn.disabled = false;
            aiSignalBtn.disabled = false;
            buyLongBtn.disabled = false;
            sellShortBtn.disabled = false;
            logToConsole(`Wallet connected: ${userAccount}`, 'ok');
            
            // Perform initial display update
            await updateWalletDisplay(provider);
            
            // Clear any previous interval and start the new 30-second poller
            if (walletUpdateInterval) clearInterval(walletUpdateInterval);
            walletUpdateInterval = window.setInterval(() => updateWalletDisplay(provider), 30000);
            
            closeConnectModal();
        } else {
           logToConsole('No accounts found. Please ensure your wallet is unlocked and has granted permissions.', 'warn');
        }
      } catch (error) {
          logToConsole(`Wallet connection process failed: ${error.message}`, 'error');
          disconnect(); // Clean up if the connection process itself fails
      }
  }

  connectMetaMaskBtn.addEventListener('click', async () => {
    if (typeof window.ethereum === 'undefined') {
      logToConsole('MetaMask is not installed. Please install a Web3 wallet.', 'error');
      return;
    }
    try {
        logToConsole('Requesting MetaMask connection...', 'info');
        await onConnect(window.ethereum);
    } catch (error) {
        logToConsole(`MetaMask connection failed: ${error.message}`, 'error');
    }
  });
  
  connectWalletConnectBtn.addEventListener('click', async () => {
      try {
          logToConsole('Opening WalletConnect modal...', 'info');
          // Fix: The `.connect()` method is part of an older Web3Modal API.
          // The modern equivalent is often `.open()`. We cast to `any` to bypass
          // strict type checking, assuming a potential version mismatch.
          const wcProvider = await (web3Modal as any).open();
          await onConnect(wcProvider);
      } catch (error) {
          logToConsole(`WalletConnect connection failed: ${error.message}`, 'error');
      }
  });
  
  function disconnect() {
    if (walletUpdateInterval) {
        clearInterval(walletUpdateInterval);
        walletUpdateInterval = null;
    }
    
    userAccount = null;
    if(provider && typeof provider.disconnect === 'function') {
      provider.disconnect();
    }
    provider = null;

    headerWalletInfo.style.display = 'none';
    walletStatusIndicator.className = 'status-dot disconnected';
    headerConnectBtn.style.display = 'inline-block';
    headerDisconnectBtn.style.display = 'none';

    swapBtn.disabled = true;
    aiSignalBtn.disabled = true;
    buyLongBtn.disabled = true;
    sellShortBtn.disabled = true;
    logToConsole('Wallet disconnected.', 'info');
  }

  headerDisconnectBtn.addEventListener('click', disconnect);

  aiSignalBtn.addEventListener('click', async () => {
    const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
    const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;

    const fromTokenId = fromTokenSelect.value;
    const toTokenId = toTokenSelect.value;
    
    const fromTokenText = fromTokenSelect.selectedOptions[0].text;
    const toTokenText = toTokenSelect.selectedOptions[0].text;

    const parseTokenText = (text: string) => {
        const match = text.match(/(.+) \((.+)\)/);
        if (match) {
            return { name: match[1].trim(), symbol: match[2].trim() };
        }
        const parts = text.split('(');
        const name = parts[0].trim();
        return { name: name, symbol: name.toUpperCase() };
    };

    const fromToken = parseTokenText(fromTokenText);
    const toToken = parseTokenText(toTokenText);
    
    if (fromTokenId.toUpperCase() === 'BITBOY' || toTokenId.toUpperCase() === 'BITBOY') {
        logToConsole('AI trade signals are not available for custom tokens like BITBOY.', 'warn');
        return;
    }

    if (fromTokenId === toTokenId) {
        logToConsole('Cannot generate a signal for the same token pair.', 'warn');
        return;
    }

    logToConsole(`Generating AI trade signal for ${fromToken.symbol}/${toToken.symbol}...`, 'info');

    async function getTokenMarketData(tokenId: string, tokenName: string) {
        try {
            const [priceResponse, chartResponse] = await Promise.all([
                fetch(`${COINGECKO_API_BASE}/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_change=true`),
                fetch(`${COINGECKO_API_BASE}/coins/${tokenId}/market_chart?vs_currency=usd&days=7&interval=daily`)
            ]);

            if (!priceResponse.ok) throw new Error(`Price fetch for ${tokenName} failed: ${priceResponse.statusText}`);
            if (!chartResponse.ok) throw new Error(`Chart fetch for ${tokenName} failed: ${chartResponse.statusText}`);
            
            const priceData = await priceResponse.json();
            const chartData = await chartResponse.json();

            const currentPriceData = priceData[tokenId];
            const prices = chartData.prices;

            if (currentPriceData && currentPriceData.usd !== undefined && prices) {
                const price = currentPriceData.usd;
                const change = currentPriceData.usd_24h_change || 0;
                let trendText = "unavailable";

                if (prices.length > 1) {
                    const startPrice = prices[0][1];
                    const endPrice = price;
                    const sevenDayChange = ((endPrice - startPrice) / startPrice) * 100;
                    trendText = `${sevenDayChange.toFixed(2)}%`;
                }
                const priceString = price.toString();
                const decimalPlaces = (priceString.split('.')[1] || '').length;
                return {
                    price: price.toFixed(Math.max(2, decimalPlaces)),
                    change: change.toFixed(2),
                    trend: trendText
                };
            }
            return null;
        } catch (error) {
            logToConsole(`Failed to fetch market data for ${tokenName}: ${error.message}`, 'error');
            return null;
        }
    }
    
    const [fromData, toData] = await Promise.all([
        getTokenMarketData(fromTokenId, fromToken.name),
        getTokenMarketData(toTokenId, toToken.name)
    ]);

    if (!fromData || !toData) {
        logToConsole('Could not fetch all necessary market data to generate a signal.', 'error');
        return;
    }
    const prompt = `
As a professional crypto trading analyst, provide a concise and actionable trade signal for the ${fromToken.symbol}/${toToken.symbol} pair.
Do not provide a lengthy explanation, just the signal.

Current Market Data:
- ${fromToken.symbol}: Price: $${fromData.price} USD, 24h Change: ${fromData.change}%, 7-day Trend: ${fromData.trend}.
- ${toToken.symbol}: Price: $${toData.price} USD, 24h Change: ${toData.change}%, 7-day Trend: ${toData.trend}.

Based on this data, provide a clear signal including:
1. Action: (e.g., BUY, SELL, HOLD, SHORT)
2. Rationale: (A brief explanation for the action based on the data provided)
3. Entry Price: (A suggested price to enter the trade)
4. Target Price: (A potential take-profit level)
5. Stop-Loss: (A price to exit if the trade goes against you)
6. Confidence: (e.g., High, Medium, Low)

After the signal, add a section titled "Risks & Considerations" with a brief, bulleted list of potential risks for this specific trade, derived from the provided market data.
    `;

    await queryAiCore(prompt);
  });

  // Leveraged Trading Logic
  leverageSlider.addEventListener('input', (e) => {
    leverageValue.textContent = `${(e.target as HTMLInputElement).value}x`;
  });
  
  leveragePresetsContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('leverage-preset-btn')) {
        const value = target.dataset.value;
        if (value) {
            leverageSlider.value = value;
            // Trigger the input event to update the label
            leverageSlider.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
  });


  function executeTrade(direction) {
    const fromTokenSelect = document.getElementById('from-token') as HTMLSelectElement;
    const toTokenSelect = document.getElementById('to-token') as HTMLSelectElement;
    const timeframeSelect = document.getElementById('leverage-timeframe') as HTMLSelectElement;

    const fromSymbol = fromTokenSelect.selectedOptions[0].text.match(/\(([^)]+)\)/)[1];
    const toSymbol = toTokenSelect.selectedOptions[0].text.match(/\(([^)]+)\)/)[1];
    const leverage = leverageSlider.value;
    const timeframe = timeframeSelect.selectedOptions[0].text;
    
    if (fromSymbol === toSymbol) {
        logToConsole('Cannot trade a token against itself.', 'warn');
        return;
    }

    const logType = direction === 'BUY' ? 'ok' : 'error';
    const action = direction === 'BUY' ? 'BUY / LONG' : 'SELL / SHORT';

    logToConsole(`Executing ${action} on ${fromSymbol}/${toSymbol} with ${leverage}x leverage on the ${timeframe} timeframe.`, logType);
  }

  buyLongBtn.addEventListener('click', () => executeTrade('BUY'));
  sellShortBtn.addEventListener('click', () => executeTrade('SELL'));
  
    // ===============================================
  // SEED PHRASE TOOL
  // ===============================================
  const seedPhraseInput = document.getElementById('seed-phrase-input') as HTMLTextAreaElement;
  const analyzeSeedBtn = document.getElementById('analyze-seed-btn') as HTMLButtonElement;
  const seedAnalysisOutput = document.getElementById('seed-analysis-output') as HTMLElement;

  function entropyToBinary(hex) {
      return hex.split('').map(i =>
          parseInt(i, 16).toString(2).padStart(4, '0')
      ).join('');
  }

  analyzeSeedBtn.addEventListener('click', () => {
      const mnemonic = seedPhraseInput.value.trim().toLowerCase();
      seedAnalysisOutput.style.display = 'none';
      seedAnalysisOutput.innerHTML = '';

      if (!mnemonic) {
          logToConsole('Seed phrase input cannot be empty.', 'warn');
          return;
      }

      const words = mnemonic.split(/\s+/);
      const wordCount = words.length;

      if (![12, 15, 18, 21, 24].includes(wordCount)) {
          logToConsole(`Invalid word count: ${wordCount}. Must be 12, 15, 18, 21, or 24.`, 'error');
          return;
      }
      
      const isValid = bip39.validateMnemonic(mnemonic);
      
      const entropyHex = isValid ? bip39.mnemonicToEntropy(mnemonic) : 'N/A';
      const entropyBits = (wordCount / 3) * 32;
      const checksumBits = wordCount / 3;

      let mainEntropyBinary = 'N/A';
      let checksumBinary = 'N/A';
      
      if(isValid) {
          const fullBinary = entropyToBinary(bip39.mnemonicToEntropy(mnemonic));
          mainEntropyBinary = fullBinary.slice(0, entropyBits);
          checksumBinary = fullBinary.slice(entropyBits);
      }
      

      const results = [
          { label: 'Status', value: isValid ? 'Valid' : 'Invalid', className: isValid ? 'valid' : 'invalid' },
          { label: 'Word Count', value: wordCount, className: '' },
          { label: 'Language', value: 'English', className: '' }, // Assuming English wordlist from library
          { label: 'Entropy', value: `${entropyBits} bits`, className: '' },
          { label: 'Checksum', value: `${checksumBits} bits`, className: '' },
          { label: 'Entropy (Hex)', value: entropyHex, className: 'mono small' },
          { label: 'Entropy (Binary)', value: mainEntropyBinary, className: 'mono small' },
          { label: 'Checksum (Binary)', value: checksumBinary, className: 'mono small' },
      ];

      results.forEach(result => {
          const row = document.createElement('div');
          row.className = 'result-row';
          row.innerHTML = `
              <span class="result-label mono">${result.label}</span>
              <span class="result-value ${result.className}">${result.value}</span>
          `;
          seedAnalysisOutput.appendChild(row);
      });
      
      seedAnalysisOutput.style.display = 'flex';
      logToConsole('Seed phrase analysis complete.', 'ok');
  });

  // ===============================================
  // RECURRING TASKS
  // ===============================================
  const taskForm = document.getElementById('recurring-task-form') as HTMLFormElement;
  const taskInput = document.getElementById('recurring-task-input') as HTMLInputElement;
  const taskSelect = document.getElementById('recurring-task-select') as HTMLSelectElement;
  const taskList = document.getElementById('recurring-task-list') as HTMLElement;
  let recurringTasks = [];

  function saveTasks() {
    try {
        localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(recurringTasks));
    } catch(e) {
        logToConsole('Could not save tasks to local storage. It may be full or disabled.', 'error');
    }
  }

  function renderTasks() {
    taskList.innerHTML = '';
    if (recurringTasks.length === 0) {
        taskList.innerHTML = '<p class="small">No recurring tasks added yet.</p>';
        return;
    }
    recurringTasks.forEach((task, index) => {
      const taskEl = document.createElement('div');
      taskEl.className = 'row';
      taskEl.style.justifyContent = 'space-between';
      taskEl.innerHTML = `
        <span class="mono">${task.text}</span>
        <div class="row">
          <span class="tag">${task.frequency}</span>
          <button data-index="${index}" class="delete-task-btn" style="background:rgba(255,51,0,0.2);color:#ff3300;padding:4px 8px;font-size:.8em;">X</button>
        </div>
      `;
      taskList.appendChild(taskEl);
    });
  }

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const taskText = taskInput.value.trim();
    if (taskText) {
      recurringTasks.push({ text: taskText, frequency: taskSelect.value });
      saveTasks();
      renderTasks();
      taskInput.value = '';
      logToConsole('Recurring task added.', 'ok');
    }
  });

  taskList.addEventListener('click', (e) => {
    // Fix: Cast e.target to HTMLElement to access properties like 'dataset'.
    const target = e.target as HTMLElement;
    if (target.classList.contains('delete-task-btn')) {
      const index = parseInt(target.dataset.index, 10);
      recurringTasks.splice(index, 1);
      saveTasks();
      renderTasks();
      logToConsole('Recurring task removed.', 'info');
    }
  });

  function loadTasks() {
    try {
        const storedTasks = localStorage.getItem(RECURRING_TASKS_KEY);
        if (storedTasks) {
          recurringTasks = JSON.parse(storedTasks);
          renderTasks();
          logToConsole('Loaded recurring tasks from local storage.', 'ok');
        } else {
            renderTasks(); // Render empty state
        }
    } catch (e) {
        logToConsole('Could not load tasks from local storage. Data may be corrupted.', 'error');
        recurringTasks = [];
        renderTasks();
    }
  }


  // ===============================================
  // CRYPTO & SYSTEM OPERATIONS
  // ===============================================
  // Hashing
  document.getElementById('hash-btn').addEventListener('click', async () => {
    const input = (document.getElementById('hash-input') as HTMLTextAreaElement).value;
    const outputEl = document.getElementById('hash-output');
    if (!input) {
      logToConsole('Hashing input cannot be empty.', 'warn');
      return;
    }
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      outputEl.textContent = hashHex;
      outputEl.style.display = 'block';
      logToConsole('SHA-256 hash generated.', 'ok');
    } catch (error) {
      logToConsole(`Hashing failed: ${error.message}`, 'error');
    }
  });

  // AES Encryption/Decryption
  async function aesAction(action) {
    const input = (document.getElementById('aes-input') as HTMLTextAreaElement).value;
    const password = (document.getElementById('aes-password') as HTMLInputElement).value;
    const outputEl = document.getElementById('aes-output');

    if (!input || !password) {
      logToConsole('AES input and password cannot be empty.', 'warn');
      return;
    }
    try {
      const salt = new TextEncoder().encode('some-static-salt-for-derivation'); // In a real app, salt should be random and stored
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        { "name": 'PBKDF2', salt, "iterations": 100000, "hash": 'SHA-256' },
        keyMaterial,
        { "name": 'AES-GCM', "length": 256 },
        true,
        ['encrypt', 'decrypt']
      );

      if (action === 'encrypt') {
        const iv = crypto.getRandomValues(new Uint8Array(12)); // IV for GCM
        const encodedData = new TextEncoder().encode(input);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedData);
        
        // Combine IV and ciphertext for storage/transmission
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        // Convert to Base64 to make it readable
        const base64String = btoa(String.fromCharCode.apply(null, combined));
        outputEl.textContent = base64String;
        logToConsole('AES encryption successful.', 'ok');
      } else { // Decrypt
        const combined = new Uint8Array(atob(input).split('').map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        const decryptedText = new TextDecoder().decode(decrypted);
        outputEl.textContent = decryptedText;
        logToConsole('AES decryption successful.', 'ok');
      }
      outputEl.style.display = 'block';
    } catch (error) {
       outputEl.textContent = `Error: ${error.message}. If decrypting, check password and ciphertext.`;
       outputEl.style.display = 'block';
       logToConsole(`AES ${action} failed: ${error.message}`, 'error');
    }
  }
  document.getElementById('aes-encrypt-btn').addEventListener('click', () => aesAction('encrypt'));
  document.getElementById('aes-decrypt-btn').addEventListener('click', () => aesAction('decrypt'));


  // API Check
  document.getElementById('check-api-btn').addEventListener('click', async () => {
    const statusEl = document.getElementById('api-status');
    statusEl.textContent = 'Pinging...';
    try {
        const response = await fetch(`${COINGECKO_API_BASE}/ping`);
        if(response.ok) {
            statusEl.textContent = 'CoinGecko API Status: OK';
            logToConsole('CoinGecko API is responsive.', 'ok');
        } else {
            throw new Error(`Status: ${response.status}`);
        }
    } catch (error) {
        statusEl.textContent = `CoinGecko API Status: Error (${error.message})`;
        logToConsole(`CoinGecko API ping failed: ${error.message}`, 'error');
    }
  });
  
  // Clear Data
  document.getElementById('clear-data-btn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all local data? This will affect recurring tasks and the Kanban board. This cannot be undone.')) {
        localStorage.removeItem(RECURRING_TASKS_KEY);
        localStorage.removeItem(KANBAN_TASKS_KEY);
        document.cookie = `${SETTINGS_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        recurringTasks = [];
        renderTasks();
        renderKanbanBoard();
        logToConsole('All local data has been cleared.', 'warn');
        // Reset settings to default and update UI
        aiSettings = { apiUrl: 'http://localhost:11434', model: 'llama3' };
        loadSettingsFromCookie();
    }
  });
  
  // ===============================================
  // HRC203X KANBAN BOARD
  // ===============================================
    let kanbanTasks = {
        backlog: [],
        inprogress: [],
        completed: []
    };

    function saveKanbanState() {
        try {
            localStorage.setItem(KANBAN_TASKS_KEY, JSON.stringify(kanbanTasks));
        } catch (e) {
            logToConsole('Could not save Kanban state to local storage.', 'error');
        }
    }

    function renderKanbanBoard() {
        Object.keys(kanbanTasks).forEach(status => {
            const columnEl = document.querySelector(`#kanban-${status} .kanban-tasks`);
            if (columnEl) {
                columnEl.innerHTML = '';
                kanbanTasks[status].forEach((task, index) => {
                    const taskEl = document.createElement('div');
                    taskEl.className = 'kanban-task';
                    taskEl.draggable = true;
                    taskEl.dataset.id = task.id;
                    taskEl.dataset.status = status;
                    taskEl.innerHTML = `
                        <button class="delete-task-btn" data-id="${task.id}" data-status="${status}">X</button>
                        <strong>${task.title}</strong>
                        <p>${task.desc}</p>
                    `;
                    columnEl.appendChild(taskEl);
                });
            }
        });
        addKanbanEventListeners();
    }

    function addKanbanEventListeners() {
        const tasks = document.querySelectorAll('.kanban-task');
        const columns = document.querySelectorAll('.kanban-column');

        tasks.forEach(task => {
            task.addEventListener('dragstart', () => {
                task.classList.add('dragging');
            });

            task.addEventListener('dragend', () => {
                task.classList.remove('dragging');
            });
            
            const deleteBtn = task.querySelector('.delete-task-btn');
            deleteBtn?.addEventListener('click', (e) => {
                const button = e.currentTarget as HTMLElement;
                const taskId = button.dataset.id;
                const taskStatus = button.dataset.status;
                kanbanTasks[taskStatus] = kanbanTasks[taskStatus].filter(t => t.id != taskId);
                saveKanbanState();
                renderKanbanBoard();
                logToConsole('Kanban task removed.', 'info');
            });
        });

        columns.forEach(column => {
            column.addEventListener('dragover', e => {
                e.preventDefault();
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', e => {
                e.preventDefault();
                column.classList.remove('drag-over');
                const draggingTask = document.querySelector('.kanban-task.dragging');
                if (draggingTask) {
                    const taskId = draggingTask.getAttribute('data-id');
                    const oldStatus = draggingTask.getAttribute('data-status');
                    const newStatus = column.getAttribute('data-status');

                    if (oldStatus !== newStatus) {
                        const taskToMove = kanbanTasks[oldStatus].find(t => t.id == taskId);
                        kanbanTasks[oldStatus] = kanbanTasks[oldStatus].filter(t => t.id != taskId);
                        kanbanTasks[newStatus].push(taskToMove);
                        saveKanbanState();
                        renderKanbanBoard();
                        logToConsole(`Task moved to ${newStatus}.`, 'info');
                    }
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
            const newTask = {
                id: Date.now().toString(),
                title,
                desc
            };
            kanbanTasks.backlog.push(newTask);
            saveKanbanState();
            renderKanbanBoard();
            titleInput.value = '';
            descInput.value = '';
            logToConsole('New task added to Kanban backlog.', 'ok');
        } else {
            logToConsole('Task title cannot be empty.', 'warn');
        }
    });

    function loadKanbanState() {
        try {
            const storedState = localStorage.getItem(KANBAN_TASKS_KEY);
            if (storedState) {
                const parsedState = JSON.parse(storedState);
                // Basic validation
                if (parsedState.backlog && parsedState.inprogress && parsedState.completed) {
                    kanbanTasks = parsedState;
                    logToConsole('Loaded Kanban board from local storage.', 'ok');
                }
            }
        } catch (e) {
            logToConsole('Could not load Kanban state.', 'error');
        }
        renderKanbanBoard();
    }
  
  // ===============================================
  // NFT FRIEND 3D CAROUSEL
  // ===============================================
    function initNftCarousel() {
        // Fix: Cast carousel to HTMLElement to access the style property.
        const carousel = document.querySelector('.carousel') as HTMLElement;
        if (!carousel) return;

        const placeholderNfts = [
            { id: 1, name: 'CryptoPunk #7523', image: 'https://i.seadn.io/s/raw/files/0a256fe3c0429a30f79365b321a4f0b2.png?auto=format&dpr=1&w=1000', owner: '0x1a2b...c3d4', lastSale: '4.2 ETH' },
            { id: 2, name: 'Bored Ape #8817', image: 'https://i.seadn.io/s/raw/files/1a889b6237c85172013854128ea3a152.png?auto=format&dpr=1&w=1000', owner: '0x5e6f...g7h8', lastSale: '88 ETH' },
            { id: 3, name: 'Azuki #9605', image: 'https://i.seadn.io/s/raw/files/425514a6894a3297650b8935c7c254d0.png?auto=format&dpr=1&w=1000', owner: '0x9i0j...k1l2', lastSale: '12 ETH' },
            { id: 4, name: 'Meebit #17522', image: 'https://i.seadn.io/s/raw/files/d5e3538418579d1349f7e522955f0580.png?auto=format&dpr=1&w=1000', owner: '0x3m4n...o5p6', lastSale: '1.5 ETH' },
            { id: 5, name: 'Pudgy Penguin #6873', image: 'https://i.seadn.io/s/raw/files/7b63952b5e523f338d9d8b8e053a4365.png?auto=format&dpr=1&w=1000', owner: '0x7q8r...s9t0', lastSale: '3.9 ETH' },
            { id: 6, name: 'Doodle #6914', image: 'https://i.seadn.io/s/raw/files/5fc8a26f8d55d1443d342023a1312521.png?auto=format&dpr=1&w=1000', owner: '0x1u2v...w3x4', lastSale: '7.1 ETH' },
        ];

        const cardCount = placeholderNfts.length;
        const angle = 360 / cardCount;
        const radius = 240 / (2 * Math.tan(Math.PI / cardCount));

        placeholderNfts.forEach((nft, i) => {
            const card = document.createElement('div');
            card.className = 'carousel-card';
            card.innerHTML = `
                <div class="carousel-card__face carousel-card__face--front" style="background-image: url('${nft.image}');"></div>
                <div class="carousel-card__face carousel-card__face--back">
                    <h5>${nft.name}</h5>
                    <p>Owner: <span class="mono">${nft.owner}</span></p>
                    <p>Last Sale: <span class="mono">${nft.lastSale}</span></p>
                </div>
            `;
            const cardAngle = angle * i;
            card.style.transform = `rotateY(${cardAngle}deg) translateZ(${radius}px)`;
            carousel.appendChild(card);
        });
        
        let currentAngle = 0;
        const prevBtn = document.getElementById('carousel-prev-btn');
        const nextBtn = document.getElementById('carousel-next-btn');

        prevBtn.addEventListener('click', () => {
            currentAngle += angle;
            carousel.style.transform = `rotateY(${currentAngle}deg)`;
        });
        nextBtn.addEventListener('click', () => {
            currentAngle -= angle;
            carousel.style.transform = `rotateY(${currentAngle}deg)`;
        });

        logToConsole('NFT Friend Carousel initialized.', 'ok');
    }
    
  // ===============================================
  // 3D PARALLAX EFFECT
  // ===============================================
  function initParallaxEffect() {
      const layers = document.querySelectorAll('.parallax-layer');
      if (layers.length === 0) return;

      window.addEventListener('mousemove', (e) => {
          const { clientX, clientY } = e;
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          const moveX = (clientX - centerX) / centerX; // Range: -1 to 1
          const moveY = (clientY - centerY) / centerY; // Range: -1 to 1

          layers.forEach((layer, index) => {
              const htmlLayer = layer as HTMLElement;
              // Increase multiplier for more pronounced depth
              const depth = (index + 1) * 2.5; 
              const x = moveX * depth;
              const y = moveY * depth;
              htmlLayer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          });
      });
      logToConsole('Initialized 3D parallax background effect.', 'info');
  }


  // ===============================================
  // INITIALIZATION
  // ===============================================
  function init() {
    logToConsole('Initializing AI Unified Tool v2.1.0 (Ollama Edition)...', 'info');
    loadSettingsFromCookie();
    updateTradingViewWidget();
    fetchCoinGeckoTrending();
    populateTokenSelects();
    loadTasks();
    loadKanbanState();
    initNftCarousel();
    initParallaxEffect();
    logToConsole('Initialization complete. Welcome!', 'ok');
  }

  init();
});