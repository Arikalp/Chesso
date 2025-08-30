// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('chesso-theme') || 'light';
  document.body.className = savedTheme === 'dark' ? 'dark-mode' : '';
  updateThemeButton();
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  
  if (isDark) {
    document.body.classList.remove('dark-mode');
    localStorage.setItem('chesso-theme', 'light');
  } else {
    document.body.classList.add('dark-mode');
    localStorage.setItem('chesso-theme', 'dark');
  }
  
  updateThemeButton();
}

function updateThemeButton() {
  const themeButton = document.getElementById('theme-toggle');
  if (themeButton) {
    const isDark = document.body.classList.contains('dark-mode');
    themeButton.textContent = isDark ? '☀️' : '🌙';
    themeButton.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', initTheme);