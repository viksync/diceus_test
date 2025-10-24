# Telegram Insurance Bot

> Note: this is a test task

This Telegram bot that helps users get an insurance policy. The bot guides the user through a series of steps to collect the necessary information and documents, and then generates an insurance policy. It uses Mindee OCR API to extract data from documents and OpenAI agent to make conversation feel human-like.

## Dependencies

- express
- mindee
- @openai/agents
- zod
- morgan
- pdfkit (to create a dummy policy)
- colorette (for colored log messages for easier debugging)

### Dev

- typescript
- esbuild
- tsx

## Setup Instructions

1. **Clone and install:**

    ```bash
    git clone https://github.com/viksync/diceus_test
    cd diceus-test
    npm install
    ```

2. **Set up environment:**

    Fill `env.sh` template file, then:

    ```bash
    source env.sh
    ```

3. **Run the bot:**
    ```bash
    npm run build
    npm run start
    ```

## Bot Architecture

The bot keeps track of its session state and can switch to a scripted workflow if OpenAI or MindeeOCR go down — so we can always finish processing insurance policies.

### Step Progression

The bot follows a **strict linear workflow** managed by `SessionStorage` and `UserSession` classes:

```
1. start                    → /start command
2. awaiting_passport        → User uploads passport photo
3. confirming_passport      → User confirms extracted data
4. awaiting_driversId       → User uploads driver's license photo
5. confirming_driversId     → User confirms extracted data
6. confirming_price         → User accepts $100 price
7. sending_policy           → Bot generates & sends PDF
8. completed                → End state
```

### Step Configuration

Each step is configured in [src/step_handlers/index.ts](src/step_handlers/index.ts).
This lets us dynamically call the appropriate handler based on the current step and the user's message.

```typescript
export const stepConfigs: StepConfigMap = {
    awaiting_passport: {
        handler: processDocument,
        documentType: 'passport',
        expectsContent: ['document', 'photo'],
        expectedAction: 'send your passport photo',
    },
    // ...
};
```

### Session State Management

User sessions are managed in-memory using `SessionStorage`
It maps `chat_id` → `UserSession` instance

Each `UserSession` stores:

- **Current step**
- **Conversation history for AI**
- **Extracted data**

**Important**: The state is currently stored in memory. For production, it needs to be persistent so the bot can survive restarts and continue conversations.
I’d use MongoDB for this — the AI agent history is JSON, so it fits naturally. Mongo isn’t the fastest, but the request volume for an insurance policy bot is low enough that it won’t matter.

### Manual AI conversation history management

This lets us handle certain actions without involving the AI agent — keeping the AI context clean and saving tokens.
For example, we send the welcome message template directly so the bot can reply instantly to `/start` instead of timing out.
It also allows us to send system messages like “File size exceeds 10 MB” without using the AI.

## Bot Workflow

When a message arrives from Telegram:

1. **Middleware validates** the update (checks secret token, validates schema)
2. **Webhook router** determines what to do:
    - Detects content type (`text`, `photo`, `document`, etc.)
    - Retrieves user's current step from `sessionStorage`
    - Gets step configuration for that step
    - If content matches expected type → calls the step's handler
    - If content is unexpected → routes to AI agent
    - If agent isn't available → retreat to scripted fallback
3. **Handler processes** the message and updates user state:
    - Moves to next step on success
    - Goes back a step on rejection
    - Stays at current step if user asks a question
4. **Wait** for next message and repeat

### Example: Successful Document Upload Flow

```
Telegram Update
  ↓
Middleware (validates)
  ↓
Webhook Router (routes to handler)
  ↓
processDocument handler
  ↓
Get file URL from Telegram
  ↓
Prompt AI agent with document URL
  ↓
AI agent calls Mindee tool to extract data
  ↓
Handler sends agent's response to user
  ↓
Handler moves user to next step
```

### Project Structure

```
src/
├── main.ts                          # Entry point & server setup
├── config.ts                        # Environment variables & constants
├── logger.ts                        # Logging utilities
├── utils.ts                         # Webhook validation & server utilities
├── routes/
│   └── webhook.ts                   # Main webhook handler & routing logic
├── middleware/
│   └── webhook.ts                   # Telegram update validation
├── session/
│   ├── UserSession.ts               # User session state class
│   └── SessionStorage.ts            # In-memory user state storage
├── handlers/
│   ├── step_configs.ts              # Step configuration map
│   ├── types.ts                     # Step handler types
│   ├── process_document.ts          # Document upload & OCR processing
│   ├── confirm_data.ts              # Data confirmation handler
│   ├── send_policy.ts               # Policy generation & delivery
│   └── utils/
│       ├── doc_summary.ts           # Document data formatting
│       └── policy_pdf.ts            # PDF generation
├── services/
│   ├── telegram/
│   │   ├── api.ts                   # Telegram API wrapper
│   │   ├── types.ts                 # Telegram type definitions
│   │   ├── schemas.ts               # Zod validation schemas
│   │   ├── errors.ts                # Custom error classes
│   │   └── helpers/
│   │       └── get_file_url.ts      # File URL retrieval
│   ├── mindee/
│   │   ├── mindee.ts                # Mindee OCR service
│   │   ├── config.ts                # Mindee configuration
│   │   └── schemas.ts               # Data validation schemas
│   └── agent/
│       ├── agent.ts                 # OpenAI agent configuration
│       ├── promptAgent.ts           # Agent execution wrapper
│       └── system_prompt.ts         # Agent instructions
```
