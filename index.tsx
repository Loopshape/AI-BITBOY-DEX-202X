

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
  logEntry.classList.add('fade-in');
  consoleElement.appendChild(logEntry);
  consoleElement.scrollTop = consoleElement.scrollHeight; // Auto-scroll
}

document.addEventListener('DOMContentLoaded', () => {

  // Fix: Moved constant declaration before its first use to prevent runtime errors.
  const RECURRING_TASKS_KEY = 'bitboy_ai_dex_tasks';
  const KANBAN_TASKS_KEY = 'nemodian_kanban_tasks';

  
  // =================