#!/usr/bin/env bash
# AI Chat System - ChatGPT Implementation
# Based on: https://chatgpt.com/share/68ba2a89-52cc-8001-ba0a-fd13623e7a49
# Author: Aris Arjuna Noorsanto <exe.opcode@gmail.com>
# Version: 2.1.0

set -eu
IFS=$'\n\t'

# -----------------------
# CONFIGURATION
# -----------------------
HOME_ROOT="${HOME:-/data/data/com.termux/files/home}"
CHAT_DIR="${HOME_ROOT}/.ai_chat"
CONVERSATIONS_DIR="${CHAT_DIR}/conversations"
PROFILES_DIR="${CHAT_DIR}/profiles"
TEMPLATES_DIR="${CHAT_DIR}/templates"

mkdir -p "$CHAT_DIR" "$CONVERSATIONS_DIR" "$PROFILES_DIR" "$TEMPLATES_DIR"

# Default configuration
DEFAULT_MODEL="gemma3:1b"
DEFAULT_TEMPERATURE="0.7"
CURRENT_CONVERSATION="default"
SESSION_FILE="${CHAT_DIR}/current_session"

# -----------------------
# LOGGING SYSTEM
# -----------------------
log() {
    local level="$1" message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "${CHAT_DIR}/chat.log"
}

log_info() { echo -e "\033[34m[*] $*\033[0m"; log "INFO" "$*"; }
log_success() { echo -e "\033[32m[+] $*\033[0m"; log "SUCCESS" "$*"; }
log_warn() { echo -e "\033[33m[!] $*\033[0m"; log "WARN" "$*"; }
log_error() { echo -e "\033[31m[-] $*\033[0m"; log "ERROR" "$*"; }

# -----------------------
# CORE CHAT FUNCTIONALITY
# -----------------------
chat_init() {
    local conversation="${1:-default}"
    CURRENT_CONVERSATION="$conversation"
    CONVERSATION_FILE="${CONVERSATIONS_DIR}/${conversation}.txt"
    
    if [ ! -f "$CONVERSATION_FILE" ]; then
        echo "# AI Conversation: $conversation" > "$CONVERSATION_FILE"
        echo "# Created: $(date)" >> "$CONVERSATION_FILE"
        echo "# Model: ${DEFAULT_MODEL}" >> "$CONVERSATION_FILE"
        echo "" >> "$CONVERSATION_FILE"
        log_success "Created new conversation: $conversation"
    else
        log_info "Resuming conversation: $conversation"
    fi
    
    echo "$conversation" > "$SESSION_FILE"
}

chat_send() {
    local message="$*"
    local response=""
    
    if [ -z "$message" ]; then
        log_error "No message provided"
        return 1
    fi
    
    # Add user message to conversation
    echo "USER: $message" >> "$CONVERSATION_FILE"
    echo "$(date '+%H:%M:%S') - You: $message"
    
    # Generate AI response
    log_info "Generating AI response..."
    response=$(generate_response "$message")
    
    # Add AI response to conversation
    echo "AI: $response" >> "$CONVERSATION_FILE"
    echo "$(date '+%H:%M:%S') - AI: $response"
    
    log_success "Response generated and conversation updated"
}

generate_response() {
    local prompt="$*"
    local context=$(get_conversation_context)
    local full_prompt="${context}${prompt}"
    
    if command -v ollama >/dev/null 2>&1; then
        echo "$full_prompt" | ollama run "$DEFAULT_MODEL" 2>/dev/null || \
        echo "I apologize, but I'm having trouble generating a response right now. Please try again."
    else
        echo "Simulated response to: $prompt (Ollama not installed)"
    fi
}

get_conversation_context() {
    # Get last 10 exchanges for context
    tail -20 "$CONVERSATION_FILE" | grep -E "^(USER|AI):" | tail -10 | \
    sed 's/^USER:/Human:/;s/^AI:/Assistant:/' | \
    awk '{print $0 "\n"}'
}

# -----------------------
# CONVERSATION MANAGEMENT
# -----------------------
chat_list() {
    echo "Available conversations:"
    echo "========================"
    ls -1 "$CONVERSATIONS_DIR"/*.txt 2>/dev/null | while read file; do
        local conv_name=$(basename "$file" .txt)
        local line_count=$(wc -l < "$file")
        local created=$(head -3 "$file" | grep "Created:" | cut -d: -f2-)
        
        echo "• $conv_name (${line_count} lines, ${created})"
    done || echo "No conversations found"
}

chat_show() {
    local conversation="${1:-}"
    
    if [ -z "$conversation" ]; then
        conversation="$CURRENT_CONVERSATION"
    fi
    
    local conv_file="${CONVERSATIONS_DIR}/${conversation}.txt"
    
    if [ ! -f "$conv_file" ]; then
        log_error "Conversation not found: $conversation"
        return 1
    fi
    
    echo "Conversation: $conversation"
    echo "=========================="
    grep -E "^(USER|AI):" "$conv_file" | tail -20 | \
    sed 's/^USER:/\x1b[34mYou:\x1b[0m/;s/^AI:/\x1b[32mAI:\x1b[0m/'
}

chat_export() {
    local conversation="${1:-}"
    local format="${2:-text}"
    
    if [ -z "$conversation" ]; then
        conversation="$CURRENT_CONVERSATION"
    fi
    
    local conv_file="${CONVERSATIONS_DIR}/${conversation}.txt"
    local export_file="${CHAT_DIR}/${conversation}_export.${format}"
    
    if [ ! -f "$conv_file" ]; then
        log_error "Conversation not found: $conversation"
        return 1
    fi
    
    case "$format" in
        text)
            cp "$conv_file" "$export_file"
            ;;
        json)
            convert_to_json "$conv_file" "$export_file"
            ;;
        markdown|md)
            convert_to_markdown "$conv_file" "$export_file"
            ;;
        *)
            log_error "Unsupported format: $format"
            return 1
            ;;
    esac
    
    log_success "Exported conversation to: $export_file"
}

convert_to_json() {
    local input="$1"
    local output="$2"
    
    echo "{" > "$output"
    echo '  "conversation": "'$(basename "$input" .txt)'",' >> "$output"
    echo '  "messages": [' >> "$output"
    
    grep -E "^(USER|AI):" "$input" | while read line; do
        local role=$(echo "$line" | cut -d: -f1 | tr '[:upper:]' '[:lower:]')
        local content=$(echo "$line" | cut -d: -f2- | sed 's/^ //')
        
        echo '    {' >> "$output"
        echo '      "role": "'$role'",' >> "$output"
        echo '      "content": "'$content'"' >> "$output"
        echo '    },' >> "$output"
    done
    
    sed -i '$ s/,$//' "$output"
    echo '  ]' >> "$output"
    echo '}' >> "$output"
}

convert_to_markdown() {
    local input="$1"
    local output="$2"
    
    echo "# Conversation: $(basename "$input" .txt)" > "$output"
    echo "**Created**: $(head -3 "$input" | grep "Created:" | cut -d: -f2-)" >> "$output"
    echo "" >> "$output"
    
    grep -E "^(USER|AI):" "$input" | while read line; do
        local role=$(echo "$line" | cut -d: -f1)
        local content=$(echo "$line" | cut -d: -f2-)
        
        if [ "$role" = "USER" ]; then
            echo "**You**: $content" >> "$output"
        else
            echo "**AI**: $content" >> "$output"
        fi
        echo "" >> "$output"
    done
}

# -----------------------
# TEMPLATE SYSTEM
# -----------------------
template_create() {
    local name="$1"
    local content="$2"
    local template_file="${TEMPLATES_DIR}/${name}.txt"
    
    if [ -z "$name" ] || [ -z "$content" ]; then
        log_error "Template name and content required"
        return 1
    fi
    
    echo "$content" > "$template_file"
    log_success "Created template: $name"
}

template_use() {
    local name="$1"
    local template_file="${TEMPLATES_DIR}/${name}.txt"
    
    if [ ! -f "$template_file" ]; then
        log_error "Template not found: $name"
        return 1
    fi
    
    local content=$(cat "$template_file")
    chat_send "$content"
}

template_list() {
    echo "Available templates:"
    echo "==================="
    ls -1 "$TEMPLATES_DIR"/*.txt 2>/dev/null | while read file; do
        local template_name=$(basename "$file" .txt)
        local line_count=$(wc -l < "$file")
        echo "• $template_name (${line_count} lines)"
    done || echo "No templates found"
}

# -----------------------
# PROFILES & SETTINGS
# -----------------------
profile_create() {
    local name="$1"
    local model="${2:-$DEFAULT_MODEL}"
    local temperature="${3:-$DEFAULT_TEMPERATURE}"
    local profile_file="${PROFILES_DIR}/${name}.conf"
    
    {
        echo "MODEL=$model"
        echo "TEMPERATURE=$temperature"
        echo "CREATED=$(date)"
    } > "$profile_file"
    
    log_success "Created profile: $name"
}

profile_use() {
    local name="$1"
    local profile_file="${PROFILES_DIR}/${name}.conf"
    
    if [ ! -f "$profile_file" ]; then
        log_error "Profile not found: $name"
        return 1
    fi
    
    source "$profile_file"
    DEFAULT_MODEL="$MODEL"
    DEFAULT_TEMPERATURE="$TEMPERATURE"
    
    log_success "Switched to profile: $name"
    echo "Model: $MODEL, Temperature: $TEMPERATURE"
}

profile_list() {
    echo "Available profiles:"
    echo "==================="
    ls -1 "$PROFILES_DIR"/*.conf 2>/dev/null | while read file; do
        local profile_name=$(basename "$file" .conf)
        local model=$(grep "^MODEL=" "$file" | cut -d= -f2)
        local temp=$(grep "^TEMPERATURE=" "$file" | cut -d= -f2)
        
        echo "• $profile_name (Model: $model, Temp: $temp)"
    done || echo "No profiles found"
}

# -----------------------
# ADVANCED FEATURES
# -----------------------
chat_analyze() {
    local conversation="${1:-$CURRENT_CONVERSATION}"
    local conv_file="${CONVERSATIONS_DIR}/${conversation}.txt"
    
    if [ ! -f "$conv_file" ]; then
        log_error "Conversation not found: $conversation"
        return 1
    fi
    
    local total_lines=$(wc -l < "$conv_file")
    local user_messages=$(grep -c "USER:" "$conv_file")
    local ai_messages=$(grep -c "AI:" "$conv_file")
    local first_message=$(grep "USER:" "$conv_file" | head -1 | cut -d: -f2-)
    local last_message=$(grep "USER:" "$conv_file" | tail -1 | cut -d: -f2-)
    
    echo "Conversation Analysis: $conversation"
    echo "==================================="
    echo "Total exchanges: $((user_messages + ai_messages))"
    echo "User messages: $user_messages"
    echo "AI responses: $ai_messages"
    echo "First user message: ${first_message:0:50}..."
    echo "Last user message: ${last_message:0:50}..."
    echo ""
    
    # Word frequency analysis
    echo "Most common words:"
    grep "USER:" "$conv_file" | tr ' ' '\n' | grep -v "USER:" | \
    tr -d '.,!?;:' | tr '[:upper:]' '[:lower:]' | \
    sort | uniq -c | sort -nr | head -5
}

chat_search() {
    local query="$*"
    local results=0
    
    if [ -z "$query" ]; then
        log_error "Search query required"
        return 1
    fi
    
    echo "Search results for: '$query'"
    echo "==========================="
    
    ls -1 "$CONVERSATIONS_DIR"/*.txt | while read file; do
        local conv_name=$(basename "$file" .txt)
        local matches=$(grep -i -c "$query" "$file")
        
        if [ "$matches" -gt 0 ]; then
            echo "Conversation: $conv_name ($matches matches)"
            grep -i -n "$query" "$file" | head -3 | while read line; do
                echo "  • $line"
            done
            echo ""
            results=$((results + 1))
        fi
    done
    
    if [ "$results" -eq 0 ]; then
        echo "No matches found"
    fi
}

# -----------------------
# MAIN COMMAND PROCESSOR
# -----------------------
process_chat_command() {
    local command="$1"
    shift
    
    case "$command" in
        init|start)
            chat_init "$1"
            ;;
        send|s)
            chat_send "$@"
            ;;
        list|ls)
            chat_list
            ;;
        show|view)
            chat_show "$1"
            ;;
        export)
            chat_export "$1" "$2"
            ;;
        analyze)
            chat_analyze "$1"
            ;;
        search)
            chat_search "$@"
            ;;
        template|tpl)
            case "$1" in
                create) template_create "$2" "$3" ;;
                use) template_use "$2" ;;
                list) template_list ;;
                *) log_error "Unknown template command: $1" ;;
            esac
            ;;
        profile|prof)
            case "$1" in
                create) profile_create "$2" "$3" "$4" ;;
                use) profile_use "$2" ;;
                list) profile_list ;;
                *) log_error "Unknown profile command: $1" ;;
            esac
            ;;
        help|--help|-h)
            show_chat_help
            ;;
        *)
            # If no specific command, treat as message
            chat_send "$command $@"
            ;;
    esac
}

show_chat_help() {
    cat << EOF
AI Chat System - Command Reference
=================================

Basic Commands:
  init [name]      Start or switch to conversation
  send <message>   Send message to AI
  list             List all conversations
  show [name]      Show recent messages
  export [name] [format] Export conversation (text/json/markdown)

Advanced Commands:
  analyze [name]   Analyze conversation statistics
  search <query>   Search across all conversations
  template create <name> <content>  Create message template
  template use <name>     Use a template
  template list           List templates
  profile create <name> [model] [temp] Create profile
  profile use <name>      Switch profile
  profile list            List profiles

Examples:
  ai chat init work-chat
  ai chat send "Hello, how are you?"
  ai chat template create greeting "Hello! I need help with..."
  ai chat profile create creative gemma3:1b 0.9
  ai chat export work-chat json
  ai chat search "quantum physics"

Shortcuts:
  s <message>      Alias for send
  ls               Alias for list
  tpl <command>    Alias for template
  prof <command>   Alias for profile

EOF
}

# -----------------------
# MAIN EXECUTION
# -----------------------
main() {
    # Load current session if exists
    if [ -f "$SESSION_FILE" ]; then
        CURRENT_CONVERSATION=$(cat "$SESSION_FILE")
        CONVERSATION_FILE="${CONVERSATIONS_DIR}/${CURRENT_CONVERSATION}.txt"
    else
        chat_init "default"
    fi
    
    # Process command
    if [ $# -eq 0 ]; then
        # Interactive mode
        echo "AI Chat System - Interactive Mode"
        echo "Type 'exit' to quit, 'help' for help"
        echo "Current conversation: $CURRENT_CONVERSATION"
        echo ""
        
        while true; do
            read -p "> " input
            case "$input" in
                exit|quit) break ;;
                help) show_chat_help ;;
                *) process_chat_command $input ;;
            esac
        done
    else
        # Command mode
        process_chat_command "$@"
    fi
}

# Handle cleanup
cleanup() {
    log "INFO" "Chat session ended"
}

trap cleanup EXIT

# Start main execution
main "$@"