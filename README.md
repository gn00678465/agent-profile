# Agent Profile Manager

AI Agent Profile Manager is an industrial-utilitarian Electron desktop application designed for power users to manage configurations for Gemini, Copilot, and Claude Code.

## 🚀 Concept: "Mission Control"

Inspired by aerospace control panels and professional developer tooling, Agent Profile Manager provides a "cockpit" experience for managing your AI agents. Each agent (Gemini, Copilot, Claude) has its own distinct visual identity, including color signatures and icon treatments, ensuring a seamless yet categorized management experience.

## ✨ Features

- **Centralized Configuration:** Manage settings for multiple AI agents in one place.
- **Pro JSON Editor:** Integrated CodeMirror 6 editor with:
  - JSON syntax highlighting.
  - Inline linting and validation (`jsonParseLinter`).
  - One-click formatting and disk synchronization.
- **Agent-Specific Themes:** The UI dynamically shifts its personality and color scheme based on the active agent.
- **Industrial Aesthetic:** A dense, focused, and high-performance UI built for developers.
- **Cross-Platform:** Built with Electron for Windows, macOS, and Linux.

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vite.dev/)
- **Desktop Wrapper:** [Electron](https://www.electronjs.org/)
- **Code Editor:** [CodeMirror 6](https://codemirror.net/) via `@uiw/react-codemirror`
- **UI Components:** [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Testing:** [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## 🏃 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server (Vite + Electron):
   ```bash
   npm run dev
   ```

### Testing

Run the test suite with Vitest:
```bash
npm test
```

Generate coverage reports:
```bash
npm run test:coverage
```

### Building & Packaging

To build and package the application for your current platform:
```bash
npm run package
```

The output will be located in the `release/` directory.

## 📄 License

This project is private and for personal use.
