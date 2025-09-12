import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { marked } from "marked";

// --- Type Definitions ---
type Message = {
    role: 'user' | 'model';
    parts: { text: string }[];
};

type ChatSession = {
    id: string;
    title: string;
    messages: Message[];
    summary: string | null;
    useMemory: boolean;
    prioritizedMemory: boolean;
    fastMode: boolean;
    learningMode: boolean;
    insights: string[];
    lastLearnedMessageCount: number;
};

type ChatHistory = Record<string, ChatSession>;

type Settings = {
    temperature: number;
    topP: number;
    topK: number;
    contextMessageCount: number;
    prioritizedContextCount: number;
};


// --- Constants ---
const LEARNING_THRESHOLD = 6; // Trigger learning after this many new messages (user + model)
const AI_MODEL = 'gemini-2.5-flash';
const INSTALLER_SCRIPT = `#!/usr/bin/env bash

# ===============================
# AI CLI - Brain Logic Enhanced
# ===============================

AI_MEMORY_DIR="\${HOME}/.ai_memory"
OLLAMA_HOST="\${OLLAMA_HOST:-http://localhost:11434}"
OLLAMA_MODEL="\${OLLAMA_MODEL:-llama3}"

mkdir -p "$AI_MEMORY_DIR"

log_info() { echo -e "[INFO] $*"; }
log_warn() { echo -e "[WARN] $*"; }
log_error() { echo -e "[ERROR] $*"; }

# -------------------------------
# Human brain inspired task logic
# -------------------------------
declare -a TASK_QUEUE

enqueue_task() {
    local prompt="$1"
    local priority="\${2:-1}" # higher = earlier
    TASK_QUEUE+=("$priority:$prompt")
}

sort_tasks() {
    IFS=$'\\n' TASK_QUEUE=($(sort -rn <<<"\${TASK_QUEUE[*]}"))
    unset IFS
}

preload_memory() {
    local prompt="$1"
    local preloaded=""
    local topics=($(extract_topics "$prompt"))
    for t in "\${topics[@]}"; do
        if [[ -f "$AI_MEMORY_DIR/$t/summary.mem" ]]; then
            preloaded+="=== $t ===\\n$(cat "$AI_MEMORY_DIR/$t/summary.mem")\\n\\n"
        fi
    done
    echo -e "$preloaded"
}

# -------------------------------
# Topic extraction & memory helpers
# -------------------------------
extract_topics() {
    local text="$1"
    local words
    read -r -a words <<< "$(echo "$text" | tr -cs '[:alnum:]' ' ')"
    local uniq_words=($(printf "%s\\n" "\${words[@]}" | tr '[:upper:]' '[:lower:]' | awk 'length($0)>3' | sort -u))
    [[ \${#uniq_words[@]} -eq 0 ]] && echo "general" || echo "\${uniq_words[@]}"
}

save_summary() {
    local topic="$1"
    local prompt="$2"
    local response="$3"
    mkdir -p "$AI_MEMORY_DIR/$topic"
    local timestamp
    timestamp=$(date +%Y%m%d%H%M%S)
    echo -e "PROMPT: $prompt\\nRESPONSE: $response\\nTIMESTAMP: $timestamp" > "$AI_MEMORY_DIR/$topic/$timestamp.mem"
    ls -1t "$AI_MEMORY_DIR/$topic"/*.mem 2>/dev/null | head -n3 | xargs cat > "$AI_MEMORY_DIR/$topic/summary.mem.tmp"
    mv "$AI_MEMORY_DIR/$topic/summary.mem.tmp" "$AI_MEMORY_DIR/$topic/summary.mem" 2>/dev/null || true
}

# -------------------------------
# Core AI processing with rules
# -------------------------------
ai_process() {
    local prompt="$1"
    local use_memory="\${2:-true}"
    local delay="\${3:-0}"

    # --- Preload memory (human brain style) ---
    local context=""
    [[ "$use_memory" == "true" ]] && context=$(preload_memory "$prompt")

    log_info "Thinking (memory=\${use_memory}, delay=\${delay}s)..."
    
    # Rule-based reasoning: prove → root → relate → evaluate → promise
    local full_prompt="$context\\n[PROCESS_RULES] PROVE → ROOT → RELATE → EVALUATE → PROMISE\\nPROMPT: $prompt"

    local response=""
    local token_count=0
    local temp_file
    temp_file=$(mktemp)

    curl -s -X POST "$OLLAMA_HOST/api/generate" \\
        -H "Content-Type: application/json" \\
        -d "{\\"model\\":\\"$OLLAMA_MODEL\\",\\"prompt\\":\\"$full_prompt\\",\\"stream\\":true}" \\
        -o "$temp_file"

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local token
        token=$(echo "$line" | jq -r '.response // empty' 2>/dev/null || echo "$line")
        [[ -n "$token" ]] || continue
        token_count=$((token_count+1))
        printf "\\033[35m[token %03d]\\033[0m %s" "$token_count" "$token"
        response+="$token"
        [[ "$delay" != "0" ]] && sleep "$delay"
    done < "$temp_file"
    echo
    rm -f "$temp_file"

    if [[ "$use_memory" == "true" && -n "$response" ]]; then
        local topics=($(extract_topics "$prompt"))
        for t in "\${topics[@]}"; do
            save_summary "$t" "$prompt" "$response"
        done
        log_info "Saved to topics: \${topics[*]}"
    fi
}

# -------------------------------
# Task runner
# -------------------------------
ai_run_tasks() {
    sort_tasks
    for task in "\${TASK_QUEUE[@]}"; do
        local prompt="\${task#*:}"
        ai_process "$prompt"
    done
}

# -------------------------------
# Help Function
# -------------------------------
ai_help() {
    echo "AI CLI - Brain Logic Enhanced"
    echo "Usage: ai {command} [options]"
    echo ""
    echo "Available commands:"
    echo "  init                      - Initializes the AI environment and memory directory."
    echo "  start                     - Checks if the Ollama server is running."
    echo "  process <prompt> [mem]    - Processes a single prompt. Set [mem] to 'false' to disable memory."
    echo "  batch <file>              - Processes each line of a file as a separate prompt."
    echo "  task <prompt> [priority]  - Adds a task to the queue. Higher priority runs first."
    echo "  run                       - Executes all tasks in the priority queue."
    echo "  help                      - Displays this help message."
}

# -------------------------------
# Main CLI
# -------------------------------
ai_main() {
    case "$1" in
        init)
            mkdir -p "$AI_MEMORY_DIR"
            log_info "AI environment initialized"
            ;;
        start)
            log_info "Starting AI server (Ollama)..."
            local count=0
            until curl -s "$OLLAMA_HOST/health" >/dev/null; do
                count=$((count+1))
                log_warn "Ollama not responding, restarting ($count)..."
                [[ $count -ge 5 ]] && { log_error "Ollama failed to start"; return 1; }
                sleep 2
            done
            log_info "Ollama server is online"
            ;;
        process)
            shift
            ai_process "$@"
            ;;
        batch)
            shift
            local file="$1"
            [[ ! -f "$file" ]] && { log_error "File not found: $file"; return 1; }
            mapfile -t lines < "$file"
            for line in "\${lines[@]}"; do
                [[ -n "$line" ]] && ai_process "$line"
            done
            ;;
        task)
            shift
            enqueue_task "$@"
            ;;
        run)
            ai_run_tasks
            ;;
        help)
            ai_help
            ;;
        *)
            echo "Usage: ai {init|start|process <prompt>|batch <file>|task <prompt> <priority>|run|help}"
            ;;
    esac
}

ai_main "$@"
`;


// --- DOM Elements ---
const newChatBtn = document.getElementById('new-chat-btn') as HTMLButtonElement;
const clearChatsBtn = document.getElementById('clear-chats-btn') as HTMLButtonElement;
const installScriptBtn = document.getElementById('install-script-btn') as HTMLButtonElement;
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const chatList = document.getElementById('chat-list') as HTMLElement;
const messageList = document.getElementById('message-list') as HTMLElement;
const welcomeMessage = document.getElementById('welcome-message') as HTMLElement;
const chatForm = document.getElementById('chat-form') as HTMLFormElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const fastModeCheckbox = document.getElementById('fast-mode-checkbox') as HTMLInputElement;
const memoryToggle = document.getElementById('memory-toggle-checkbox') as HTMLInputElement;
const prioritizedMemoryCheckbox = document.getElementById('prioritized-memory-checkbox') as HTMLInputElement;
const learningModeCheckbox = document.getElementById('learning-mode-checkbox') as HTMLInputElement;
const learningModeLabel = document.querySelector('label[for="learning-mode-checkbox"]') as HTMLLabelElement;
const summarizeBtn = document.getElementById('summarize-btn') as HTMLButtonElement;
const exportChatBtn = document.getElementById('export-chat-btn') as HTMLButtonElement;
const chatSummaryContainer = document.getElementById('chat-summary-container') as HTMLElement;
const chatSummaryText = document.getElementById('chat-summary-text') as HTMLElement;

// --- Settings Modal Elements ---
const settingsModal = document.getElementById('settings-modal') as HTMLElement;
const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('save-settings-btn') as HTMLButtonElement;
const cancelSettingsBtn = document.getElementById('cancel-settings-btn') as HTMLButtonElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;
const topPSlider = document.getElementById('top-p-slider') as HTMLInputElement;
const topPValue = document.getElementById('top-p-value') as HTMLSpanElement;
const topKSlider = document.getElementById('top-k-slider') as HTMLInputElement;
const topKValue = document.getElementById('top-k-value') as HTMLSpanElement;
const contextMessagesInput = document.getElementById('context-messages-input') as HTMLInputElement;
const prioritizedContextInput = document.getElementById('prioritized-context-input') as HTMLInputElement;


// --- State ---
let chats: ChatHistory = {};
let settings: Settings;
let currentChatId: string | null = null;
let ai: GoogleGenAI | null = null;
let isGenerating = false;

// --- Initialization ---
function initialize() {
    const API_KEY = process.env.API_KEY;
    if (API_KEY) {
        try {
            ai = new GoogleGenAI({ apiKey: API_KEY });
        } catch (error) {
            console.error("Failed to initialize GoogleGenAI:", error);
            showToast("Failed to initialize AI. Check API Key.", 'error');
        }
    } else {
        showToast("API_KEY environment variable not set.", 'error');
    }

    chats = loadChatsFromLocalStorage();
    settings = loadSettingsFromLocalStorage();
    
    const chatIds = Object.keys(chats);
    if (chatIds.length > 0) {
        const lastChatId = localStorage.getItem('lastActiveChatId');
        switchChat(lastChatId && chats[lastChatId] ? lastChatId : chatIds[0]);
    } else {
        createNewChat();
    }
    renderChatList();

    // --- Event Listeners ---
    newChatBtn.addEventListener('click', createNewChat);
    clearChatsBtn.addEventListener('click', clearAllChats);
    installScriptBtn.addEventListener('click', handleInstallScript);
    chatForm.addEventListener('submit', handleFormSubmit);
    summarizeBtn.addEventListener('click', handleSummarizeClick);
    exportChatBtn.addEventListener('click', handleExportChat);
    settingsBtn.addEventListener('click', openSettingsModal);
    
    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.requestSubmit();
        }
    });
    promptInput.addEventListener('input', autoResizeTextarea);
    
    [fastModeCheckbox, memoryToggle, prioritizedMemoryCheckbox, learningModeCheckbox].forEach(el => {
        el.addEventListener('change', () => {
            if (currentChatId) {
                chats[currentChatId].fastMode = fastModeCheckbox.checked;
                chats[currentChatId].useMemory = memoryToggle.checked;
                chats[currentChatId].prioritizedMemory = prioritizedMemoryCheckbox.checked;
                chats[currentChatId].learningMode = learningModeCheckbox.checked;
                saveChatsToLocalStorage();
            }
            updateToggleStates();
        });
    });

    // Modal listeners
    closeModalBtn.addEventListener('click', closeSettingsModal);
    cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeSettingsModal();
    });
    saveSettingsBtn.addEventListener('click', saveSettings);
    temperatureSlider.addEventListener('input', () => temperatureValue.textContent = temperatureSlider.value);
    topPSlider.addEventListener('input', () => topPValue.textContent = topPSlider.value);
    topKSlider.addEventListener('input', () => topKValue.textContent = topKSlider.value);


    updateToggleStates();
}

// --- Chat Management ---
function createNewChat() {
    const newId = `chat_${Date.now()}`;
    chats[newId] = {
        id: newId,
        title: "New Chat",
        messages: [],
        summary: null,
        useMemory: true,
        prioritizedMemory: true,
        fastMode: false,
        learningMode: true,
        insights: [],
        lastLearnedMessageCount: 0,
    };
    switchChat(newId);
}

function switchChat(chatId: string) {
    if (!chats[chatId]) return;
    currentChatId = chatId;
    localStorage.setItem('lastActiveChatId', chatId);

    const currentChat = chats[currentChatId];
    fastModeCheckbox.checked = currentChat.fastMode ?? false;
    memoryToggle.checked = currentChat.useMemory;
    prioritizedMemoryCheckbox.checked = currentChat.prioritizedMemory;
    learningModeCheckbox.checked = currentChat.learningMode;
    
    renderChatMessages();
    renderChatList();
    renderChatSummary();
    updateToggleStates();
}

function deleteChat(chatId: string) {
    if (!chats[chatId]) return;
    delete chats[chatId];
    if (currentChatId === chatId) {
        const remainingChatIds = Object.keys(chats);
        if (remainingChatIds.length > 0) {
            switchChat(remainingChatIds[0]);
        } else {
            createNewChat();
        }
    }
    renderChatList();
    saveChatsToLocalStorage();
}

function clearAllChats() {
    if (confirm("Are you sure you want to delete all chats? This action cannot be undone.")) {
        chats = {};
        currentChatId = null;
        createNewChat();
    }
}

// --- Rendering ---
function renderChatList() {
    chatList.innerHTML = '';
    Object.values(chats).reverse().forEach(chat => {
        const li = document.createElement('li');
        li.className = 'chat-item';
        li.dataset.chatId = chat.id;
        if (chat.id === currentChatId) {
            li.classList.add('active');
        }
        li.innerHTML = `
            <span class="chat-title">${chat.title}</span>
            <button class="delete-chat-btn" aria-label="Delete chat"><i class="fas fa-times-circle"></i></button>
        `;
        li.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.delete-chat-btn')) {
                deleteChat(chat.id);
            } else {
                switchChat(chat.id);
            }
        });
        chatList.appendChild(li);
    });
}

function renderChatMessages() {
    messageList.innerHTML = '';
    if (currentChatId && chats[currentChatId].messages.length > 0) {
        welcomeMessage.style.display = 'none';
        chats[currentChatId].messages.forEach(message => renderMessage(message));
    } else {
        welcomeMessage.style.display = 'flex';
    }
    messageList.scrollTop = messageList.scrollHeight;
}

function renderChatSummary() {
    if (!currentChatId) return;
    const summary = chats[currentChatId].summary;

    if (summary) {
        chatSummaryText.textContent = summary;
        chatSummaryContainer.style.display = 'block';
    } else {
        chatSummaryContainer.style.display = 'none';
    }
}


async function renderMessage(message: Message, stream = false) {
    const messageId = `message-${Date.now()}-${Math.random()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.id = messageId;
    
    const parsedContent = await marked.parse(message.parts[0].text || "...");

    messageDiv.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-${message.role === 'user' ? 'user' : 'robot'}"></i>
        </div>
        <div class="message-content">
            <div class="message-body">
                ${parsedContent}
            </div>
        </div>
    `;

    if (stream) {
        const existingStreamMessage = messageList.querySelector('.message.model:last-child .message-body');
        if (existingStreamMessage) {
            existingStreamMessage.innerHTML = parsedContent;
        } else {
             messageList.appendChild(messageDiv);
        }
    } else {
        messageList.appendChild(messageDiv);
    }
    messageList.scrollTop = messageList.scrollHeight;
    return messageId;
}

// --- Form & Input Handling ---
async function handleFormSubmit(e: Event) {
    e.preventDefault();
    if (!currentChatId || isGenerating) return;

    const prompt = promptInput.value.trim();
    if (!prompt) return;

    isGenerating = true;
    updateToggleStates();
    promptInput.value = '';
    autoResizeTextarea();

    const userMessage: Message = { role: 'user', parts: [{ text: prompt }] };
    chats[currentChatId].messages.push(userMessage);
    renderMessage(userMessage);
    welcomeMessage.style.display = 'none';

    // Rename first chat
    if (chats[currentChatId].messages.length === 1 && chats[currentChatId].title === "New Chat") {
        chats[currentChatId].title = prompt.substring(0, 30) + (prompt.length > 30 ? "..." : "");
        renderChatList();
    }
    
    try {
        if (!ai) throw new Error("AI not initialized.");
        
        let context = await buildContext(prompt);
        
        const responseStream = await ai.models.generateContentStream({
            model: AI_MODEL,
            contents: [...context, userMessage],
            config: {
                temperature: settings.temperature,
                topP: settings.topP,
                topK: settings.topK
            }
        });

        let fullResponse = "";
        let streamedMessage: Message = { role: 'model', parts: [{ text: "..." }]};
        
        for await (const chunk of responseStream) {
            fullResponse += chunk.text;
            streamedMessage.parts[0].text = fullResponse;
            renderMessage(streamedMessage, true);
        }

        chats[currentChatId].messages.push({ role: 'model', parts: [{ text: fullResponse }] });
        triggerLearning();

    } catch (error) {
        console.error("Error generating content:", error);
        renderMessage({ role: 'model', parts: [{ text: "Sorry, I encountered an error. Please try again." }] });
    } finally {
        isGenerating = false;
        updateToggleStates();
        saveChatsToLocalStorage();
    }
}

async function handleSummarizeClick() {
    if (!currentChatId || !ai || isGenerating) return;

    const currentChat = chats[currentChatId];
    if (currentChat.messages.length < 2) {
        showToast("Not enough conversation to summarize.", 'info');
        return;
    }

    isGenerating = true;
    updateToggleStates();
    summarizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Summarizing...';

    try {
        const transcript = currentChat.messages
            .map(m => `${m.role}: ${m.parts[0].text}`)
            .join('\n\n');

        const prompt = `Please provide a concise, one-sentence summary of the following conversation transcript.

Transcript:
---
${transcript}
---`;

        const response = await ai.models.generateContent({ 
            model: AI_MODEL, 
            contents: prompt,
            config: {
                temperature: settings.temperature // Use configured temp for consistency
            }
        });
        const summary = response.text.trim();

        currentChat.summary = summary;
        saveChatsToLocalStorage();
        renderChatSummary();
        showToast("Summary generated!");

    } catch (error) {
        console.error("Failed to generate summary:", error);
        showToast("Sorry, couldn't generate a summary.", 'error');
    } finally {
        isGenerating = false;
        summarizeBtn.innerHTML = '<i class="fas fa-file-alt"></i> Summarize';
        updateToggleStates();
    }
}

function handleExportChat() {
    if (!currentChatId || !chats[currentChatId]) {
        showToast("No active chat to export.", 'info');
        return;
    }

    const currentChat = chats[currentChatId];
    if (currentChat.messages.length === 0) {
        showToast("Chat is empty, nothing to export.", 'info');
        return;
    }

    const transcript = currentChat.messages
        .map(m => `${m.role.charAt(0).toUpperCase() + m.role.slice(1)}: ${m.parts[0].text}`)
        .join('\n\n');

    let fileContent = `Chat Title: ${currentChat.title}\n`;
    if (currentChat.summary) {
        fileContent += `Summary: ${currentChat.summary}\n`;
    }
    fileContent += `\n========================================\n\n${transcript}`;

    const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const safeTitle = currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${safeTitle}_export.txt`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast("Chat exported successfully!");
}

function handleInstallScript() {
    const blob = new Blob([INSTALLER_SCRIPT], { type: 'text/x-shellscript' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'install_ai_cli.sh';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast("CLI installer script downloaded!");
}


function autoResizeTextarea() {
    promptInput.style.height = 'auto';
    promptInput.style.height = `${promptInput.scrollHeight}px`;
}

// --- AI & Logic ---
async function buildContext(prompt: string): Promise<Message[]> {
    if (!currentChatId) return [];
    const currentChat = chats[currentChatId];

    // If fast mode is on, or memory is off, send no context.
    if (currentChat.fastMode || !currentChat.useMemory) {
        return [];
    }
    
    const history = currentChat.messages.slice(0, -1); // All messages except the last user prompt

    // Start building context with learned insights, if any.
    let context: Message[] = [];
    if (currentChat.insights.length > 0) {
        const insightsText = "--- Learned Insights (for context) ---\n" + currentChat.insights.join("\n");
        context.push({ role: 'user', parts: [{ text: insightsText }] });
        context.push({ role: 'model', parts: [{ text: "Acknowledged. I will use these insights." }] });
    }

    // Now, add conversational history based on the memory mode.
    if (currentChat.prioritizedMemory) {
        // Semantic Search for Prioritized Memory
        // If history is too short for a meaningful search, just use recent messages.
        if (history.length <= settings.prioritizedContextCount) {
            return [...context, ...history.slice(-settings.contextMessageCount)];
        }

        try {
            if (!ai) throw new Error("AI not initialized for context building.");

            // Format history for the meta-prompt
            const formattedHistory = history
                .map((msg, index) => `[${index}] ${msg.role}: ${msg.parts[0].text.substring(0, 200)}...`) // Truncate for efficiency
                .join('\n');
            
            const metaPrompt = `You are a context-analysis expert. Given a user's latest prompt and a conversation history, your task is to identify the most relevant messages from the history that will help formulate the best response.

Latest User Prompt: "${prompt}"

Conversation History (with indices and truncated content):
---
${formattedHistory}
---

From the history, select the ${settings.prioritizedContextCount} most semantically relevant messages. Your response MUST be a JSON array of the message indices only. For example: [3, 8, 10]`;

            const response = await ai.models.generateContent({
                model: AI_MODEL,
                contents: metaPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.INTEGER }
                    },
                    temperature: 0.1, // Low temp for deterministic task
                }
            });

            const responseText = response.text.trim();
            const relevantIndices = JSON.parse(responseText) as number[];
            
            if (!Array.isArray(relevantIndices)) {
                 throw new Error("AI did not return a valid array for indices.");
            }

            const prioritizedMessages = relevantIndices
                .filter(index => typeof index === 'number' && index >= 0 && index < history.length)
                .sort((a, b) => a - b) // Sort to maintain conversational order
                .map(index => history[index]);
            
            console.log(`Semantic search selected message indices: ${relevantIndices.join(', ')}`);
            return [...context, ...prioritizedMessages];

        } catch (error) {
            console.error("Semantic context search failed. Falling back to recent messages.", error);
            // On failure, fall back to just using the most recent messages.
            return [...context, ...history.slice(-settings.contextMessageCount)];
        }

    } else {
        // Standard Memory: just the N most recent messages.
        return [...context, ...history.slice(-settings.contextMessageCount)];
    }
}


async function triggerLearning() {
    if (!currentChatId || !ai) return;
    const currentChat = chats[currentChatId];

    const shouldLearn = currentChat.learningMode && 
                        (currentChat.messages.length - currentChat.lastLearnedMessageCount) > LEARNING_THRESHOLD;

    if (!shouldLearn) return;

    learningModeLabel.classList.add('processing');
    try {
        const transcript = currentChat.messages
            .slice(-LEARNING_THRESHOLD)
            .map(m => `${m.role}: ${m.parts[0].text}`)
            .join('\n\n');
        
        const prompt = `Analyze the following conversation transcript and extract 1-3 key insights, facts, or user preferences. Present them as a concise list, with each insight on a new line. Do not add any conversational fluff, headers, or bullet points. Just the raw text of the insights.

Transcript:
${transcript}`;

        const response = await ai.models.generateContent({ 
            model: AI_MODEL, 
            contents: prompt,
            config: {
                temperature: settings.temperature // Use configured temp for consistency
            }
        });
        const newInsights = response.text.split('\n').map(s => s.trim()).filter(Boolean);
        
        if (newInsights.length > 0) {
            const uniqueNewInsights = newInsights.filter(insight => !currentChat.insights.includes(insight));
            if (uniqueNewInsights.length > 0) {
                currentChat.insights.push(...uniqueNewInsights);
                currentChat.lastLearnedMessageCount = currentChat.messages.length;
                saveChatsToLocalStorage();
                showToast("New insights learned!");
            }
        }
    } catch (error) {
        console.error("Failed to learn insights:", error);
    } finally {
        learningModeLabel.classList.remove('processing');
    }
}


function updateToggleStates() {
    sendBtn.disabled = isGenerating;
    summarizeBtn.disabled = isGenerating;
    exportChatBtn.disabled = isGenerating;
    if (isGenerating) {
        sendBtn.innerHTML = '<div class="typing-indicator"></div>';
    } else {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }

    const fastModeEnabled = fastModeCheckbox.checked;
    const memoryEnabled = memoryToggle.checked && !fastModeEnabled;
    
    memoryToggle.disabled = fastModeEnabled;
    (memoryToggle.parentElement as HTMLElement).style.opacity = fastModeEnabled ? '0.5' : '1';

    prioritizedMemoryCheckbox.disabled = !memoryEnabled;
    learningModeCheckbox.disabled = !memoryEnabled;

    const parent1 = prioritizedMemoryCheckbox.parentElement as HTMLElement;
    const parent2 = learningModeCheckbox.parentElement as HTMLElement;
    if (!memoryEnabled) {
        parent1.style.opacity = '0.5';
        parent2.style.opacity = '0.5';
    } else {
        parent1.style.opacity = '1';
        parent2.style.opacity = '1';
    }
}

// --- Settings Modal Logic ---
function openSettingsModal() {
    temperatureSlider.value = String(settings.temperature);
    temperatureValue.textContent = String(settings.temperature);
    topPSlider.value = String(settings.topP);
    topPValue.textContent = String(settings.topP);
    topKSlider.value = String(settings.topK);
    topKValue.textContent = String(settings.topK);
    contextMessagesInput.value = String(settings.contextMessageCount);
    prioritizedContextInput.value = String(settings.prioritizedContextCount);
    
    settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
}

function saveSettings() {
    settings = {
        temperature: parseFloat(temperatureSlider.value),
        topP: parseFloat(topPSlider.value),
        topK: parseInt(topKSlider.value, 10),
        contextMessageCount: parseInt(contextMessagesInput.value, 10),
        prioritizedContextCount: parseInt(prioritizedContextInput.value, 10)
    };
    saveSettingsToLocalStorage();
    showToast('Settings saved successfully!');
    closeSettingsModal();
}


// --- Local Storage & Utilities ---
function saveChatsToLocalStorage() {
    try {
        localStorage.setItem('chatHistory', JSON.stringify(chats));
    } catch (error) {
        console.error("Could not save chats to local storage:", error);
        showToast("Error saving chat history.", 'error');
    }
}

function loadChatsFromLocalStorage(): ChatHistory {
    try {
        const storedChats = localStorage.getItem('chatHistory');
        if (storedChats) {
            return JSON.parse(storedChats);
        }
    } catch (error) {
        console.error("Could not load chats from local storage:", error);
    }
    return {};
}

function saveSettingsToLocalStorage() {
    try {
        localStorage.setItem('aiAppSettings', JSON.stringify(settings));
    } catch (error) {
        console.error("Could not save settings to local storage:", error);
        showToast("Error saving settings.", 'error');
    }
}

function loadSettingsFromLocalStorage(): Settings {
    const defaultSettings: Settings = {
        temperature: 0.5,
        topP: 0.95,
        topK: 40,
        contextMessageCount: 6,
        prioritizedContextCount: 5
    };
    try {
        const storedSettings = localStorage.getItem('aiAppSettings');
        if (storedSettings) {
            return { ...defaultSettings, ...JSON.parse(storedSettings) };
        }
    } catch (error) {
        console.error("Could not load settings from local storage:", error);
    }
    return defaultSettings;
}

function showToast(message: string, type: 'info' | 'error' = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
    });

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- App Start ---
document.addEventListener('DOMContentLoaded', initialize);