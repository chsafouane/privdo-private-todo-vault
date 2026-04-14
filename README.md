# Local Todo Manager

A simple, private, and secure todo list application that encrypts your tasks locally on your device. Designed with privacy in mind—no cloud storage, no account required, and fully offline capable.

## Features

- **🔒 Local Encryption:** All tasks are encrypted using AES-256 (`crypto-js`) before being stored locally on your device.
- **📱 Installable App (PWA):** Works seamlessly as a standalone application on macOS, iOS, Android, and Windows.
- **⚡ Offline First:** Everything is stored locally via `localforage`. No internet connection needed.
- **🎨 Beautiful UI:** Built with React, TailwindCSS, and Framer Motion for a smooth user experience.

## How to Use

1. **Add a Task:** Simply type your task in the input field and hit "Add" or press Enter.
2. **Complete a Task:** Click the checkbox next to any active task to mark it as complete.
3. **Delete a Task:** Click the trash icon next to a task to permanently remove it. 
4. *(All data is automatically encrypted and saved seamlessly as you interact with the app).*

## How to Install (Add to Home Screen)

Because this app is a Progressive Web App (PWA), you can install it directly to your device for a native-like experience. Make sure you are visiting the URL where the app is hosted (or your computer's local IP address if running the dev server on the same Wi-Fi).

### iPhone / iPad (Safari)
1. Open the app's URL in **Safari**.
2. Tap the **Share** button at the bottom of the screen (the square with an arrow pointing up).
3. Scroll down and tap **"Add to Home Screen"**.
4. Confirm by tapping **"Add"** in the top right corner. The app will now appear on your home screen.

### macOS, Windows, Linux (Chrome / Edge / Arc)
1. Open the app in your browser (e.g., **Google Chrome**).
2. Look at the right side of the address bar at the top of the browser. You should see an **Install** icon (a monitor with a downward arrow).
3. Click the icon and select **"Install"**.
4. The app will open in its own window and be added to your computer's Applications or Start menu.

### Android (Chrome)
1. Open the app in **Chrome**.
2. Tap the three-dot menu button in the top right corner.
3. Tap **"Install app"** or **"Add to Home screen"**.
4. Follow the on-screen prompt to confirm. 

## Development

To run this project locally:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build
```

## License

MIT

### macOS Desktop App (.dmg)
You can also build and install a native `.dmg` file to install it directly into your Applications folder.

To start the desktop app in development mode:
```bash
npm run electron:dev
```

To build the macOS `.dmg` installer:
```bash
npm run electron:build
```
Once the build script finishes, look inside the `release` folder to find your `.dmg` file. Just double-click it and drag the app into your Applications folder!
