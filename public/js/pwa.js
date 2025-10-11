// PWA Installation and Service Worker Registration

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// PWA Install Prompt
let deferredPrompt;
const installButton = document.createElement('button');
installButton.textContent = 'Install App';
installButton.className = 'install-btn';
installButton.style.display = 'none';

// Listen for beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show install button
  showInstallButton();
});

function showInstallButton() {
  // Add install button to header if it exists
  const header = document.querySelector('.lobby-header') || document.querySelector('.game-header');
  if (header && !document.querySelector('.install-btn')) {
    const userInfo = header.querySelector('.user-info') || header.querySelector('.game-controls');
    if (userInfo) {
      installButton.style.display = 'block';
      userInfo.insertBefore(installButton, userInfo.firstChild);
    }
  }
}

// Install button click handler
installButton.addEventListener('click', (e) => {
  // Hide the install button
  installButton.style.display = 'none';
  // Show the install prompt
  deferredPrompt.prompt();
  // Wait for the user to respond to the prompt
  deferredPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    deferredPrompt = null;
  });
});

// Listen for app installed event
window.addEventListener('appinstalled', (evt) => {
  console.log('Chesso app was installed');
  // Hide install button if still visible
  if (installButton) {
    installButton.style.display = 'none';
  }
});