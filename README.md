# Medical Billing Auditor

A comprehensive medical billing audit application that leverages AI to analyze medical invoices.

## Features

- **AI-Powered Analysis:** Uses Gemini 3.1 Pro to perform administrative, medical, and financial audits on invoice images.
- **Multi-Language Support:** Full support for English and Arabic interfaces and AI responses.
- **User Authentication:** Secure login via Google Authentication (Firebase).
- **Audit History:** Logged-in users can view their past audit reports.
- **Interactive Chatbot:** An AI assistant that understands the context of the current invoice and can answer specific questions.
- **Visual Snippets:** Automatically crops and highlights the specific areas of the invoice where errors or suspicious items were found.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- Firebase (Auth & Firestore)
- Google GenAI SDK

## Getting Started

1. Clone the repository.
2. Install dependencies: \`npm install\`
3. Set up your environment variables (see \`.env.example\`).
4. Run the development server: \`npm run dev\`
