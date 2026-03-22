# Boggle FE

A real-time multiplayer Boggle game frontend built with React, TypeScript, Vite, and Tailwind CSS.

## Features

- Create or join Boggle lobbies
- Real-time updates via WebSocket
- Responsive, modern UI with Tailwind CSS

## Setup

1. **Install dependencies:**

   ```sh
   npm install
   ```

2. **Configure API URL (optional):**

   By default, the frontend connects to `http://localhost:8080`.  
   To use a different backend URL, set the `VITE_API_URL` environment variable in a `.env` file:

   ```
   VITE_API_URL=http://your-backend-url
   ```

3. **Start the development server:**

   ```sh
   npm run dev
   ```

4. **Build for production:**

   ```sh
   npm run build
   ```

5. **Preview the production build:**

   ```sh
   npm run preview
   ```

---

This project uses [Vite](https://vitejs.dev/), [React](https://react.dev/), and [Tailwind CSS](https://tailwindcss.com/).