(() => {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let isTauri = false;
  let startPos = { x: 0, y: 0 };
  let videoPlayer = null;
  let dragHandle = null;
  let isClosing = false;

  // Initialize app
  document.addEventListener('DOMContentLoaded', async () => {
    videoPlayer = document.getElementById('videoPlayer');
    if (!videoPlayer) {
      console.error("Video player element not found");
      return;
    }

    dragHandle = document.getElementsByClassName('controls');
    if (!dragHandle) {
      console.error("Drag handle element not found");
      return;
    }

    document.body.style.transform = '';
    document.body.style.transition = 'transform 0.2s ease';

    isTauri = await detectTauri();
    console.log(isTauri ? "Tauri mode" : "Browser mode");

    addOpenFileButton();
    setupWindowControls();
    setupDragBehavior();
    setupFileDrop();
  });

  // Detect Tauri environment
  async function detectTauri() {
    try {
      if (window.__TAURI__) {
        await new Promise((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            if (window.__TAURI__?.window?.appWindow?.setPosition) {
              resolve(true);
            } else if (attempts++ > 30) {
              reject(new Error('Tauri APIs not available'));
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });
        return true;
      }
    } catch (e) {
      console.log("Running in browser mode");
    }
    return false;
  }

  // Add open file button dynamically
  function addOpenFileButton() {
    const openFileBtn = document.createElement('button');
    openFileBtn.id = 'openFileBtn';
    openFileBtn.textContent = 'Open File';
    openFileBtn.style.margin = '0 5px';
    openFileBtn.style.padding = '5px 10px';
    openFileBtn.style.background = '#444';
    openFileBtn.style.color = 'white';
    openFileBtn.style.border = 'none';
    openFileBtn.style.borderRadius = '3px';
    openFileBtn.style.cursor = 'pointer';
    openFileBtn.style.webkitAppRegion = 'no-drag';

    openFileBtn.addEventListener('click', openFileDialog);

    const closeBtn = document.getElementById('closeBtn');
    if (closeBtn) closeBtn.insertAdjacentElement('afterend', openFileBtn);
  }

  // Handle file dialog
  async function openFileDialog() {
    try {
      let filePath;

      if (isTauri) {
        const selected = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{
            name: 'Video Files',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'ogg']
          }]
        });
        if (!selected) return;
        filePath = selected;
      } else {
        filePath = await new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'video/*';
          input.onchange = (e) => resolve(e.target.files[0]);
          input.click();
        });
      }

      if (filePath) await loadVideo(filePath);
    } catch (error) {
      console.error("Error opening file:", error);
    }
  }

  // Load video file
  async function loadVideo(filePath) {
    try {
      let videoSrc;

      if (isTauri) {
        videoSrc = await window.__TAURI__.window.convertFileSrc(filePath);
      } else {
        videoSrc = URL.createObjectURL(filePath);
      }

      videoPlayer.src = videoSrc;
      videoPlayer.load();
      await videoPlayer.play();
    } catch (error) {
      console.error("Error loading video:", error);
    }
  }

  // Setup file drop zone
  function setupFileDrop() {
    const dropZone = document.body;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.style.outline = '2px dashed #4CAF50';
        dropZone.style.outlineOffset = '-10px';
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.style.outline = 'none';
      });
    });

    dropZone.addEventListener('drop', async (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('video/')) {
          await loadVideo(file);
        } else {
          console.log('Dropped file is not a video');
        }
      }
    });
  }

  // Setup drag behavior
  function setupDragBehavior() {
    if (!dragHandle) return;

    dragHandle.style.cursor = 'move';
    dragHandle.style.userSelect = 'none';

    dragHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      isDragging = true;
      startPos = { x: e.clientX, y: e.clientY };

      if (isTauri) {
        window.__TAURI__.window.appWindow.position()
          .then(pos => {
            offsetX = e.screenX - pos.x;
            offsetY = e.screenY - pos.y;
          })
          .catch(console.error);
      } else {
        offsetX = e.clientX;
        offsetY = e.clientY;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      if (isTauri && window.__TAURI__?.window?.appWindow?.setPosition) {
        window.__TAURI__.window.appWindow.setPosition({
          x: e.screenX - offsetX,
          y: e.screenY - offsetY
        }).catch(console.error);
      } else {
        const moveX = e.clientX - startPos.x;
        const moveY = e.clientY - startPos.y;
        document.body.style.transform = `translate(${moveX}px, ${moveY}px)`;
        document.body.style.transition = 'none';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;

        if (!isTauri) {
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          document.body.style.transform = '';
          document.body.style.transition = 'transform 0.2s ease';
        }
      }
    });
  }

  // Setup window controls
  function setupWindowControls() {
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const closeBtn = document.getElementById('closeBtn');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');

    if (minimizeBtn) minimizeBtn.onclick = minimizeWindow;
    if (maximizeBtn) maximizeBtn.onclick = toggleMaximize;
    if (closeBtn) closeBtn.onclick = closeWindow;
    if (playBtn) playBtn.onclick = () => videoPlayer?.play();
    if (pauseBtn) pauseBtn.onclick = () => videoPlayer?.pause();

    if (isTauri && window.__TAURI__?.window?.appWindow?.listen) {
      window.__TAURI__.window.appWindow.listen(
        'tauri://close-requested',
        async (event) => {
          event.preventDefault();
          await cleanupBeforeClose();
          window.__TAURI__.window.appWindow.close();
        }
      );
    }
  }

  // Minimize window
  function minimizeWindow() {
    if (isTauri) {
      window.__TAURI__.window.appWindow.minimize().catch(console.error);
    } else {
      document.body.style.transform = 'translateY(100%)';
      setTimeout(() => {
        document.body.style.display = 'none';
      }, 300);
    }
  }

  // Toggle maximize state
  async function toggleMaximize() {
    if (isTauri) {
      try {
        const isMaximized = await window.__TAURI__.window.appWindow.isMaximized();
        isMaximized
          ? window.__TAURI__.window.appWindow.unmaximize()
          : window.__TAURI__.window.appWindow.maximize();
      } catch (error) {
        console.error("Maximize error:", error);
      }
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }
  }

  // Close window
  async function closeWindow() {
    if (isClosing) return;
    isClosing = true;

    try {
      await cleanupBeforeClose();

      if (isTauri) {
        await window.__TAURI__.window.appWindow.close();
      } else {
        window.close();
      }
    } catch (error) {
      console.error("Close error:", error);
      isClosing = false;
    }
  }

  // Cleanup before closing
  async function cleanupBeforeClose() {
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');

      if (!isTauri && videoPlayer.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoPlayer.src);
      }
    }
  }
})();