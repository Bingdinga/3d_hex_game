// Import statements
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Import your own modules
import { HexUtils } from './HexUtils.js';
import { VoxelModelManager } from '../models/VoxelModelManager.js';
import { HexGrid } from './HexGrid.js';
import { UI } from '../ui/UI.js';
import { SocketManager } from '../networking/Socket.js';

import { FPSCounter } from '../utils/FPSCounter.js';

// Make THREE available globally for compatibility
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;

/**
 * Main entry point for the 3D Hex Grid application
 */
class App {
  constructor() {
    console.log('App constructor started');

    try {
      // Initialize Three.js
      this.initThree();
      console.log('Three.js initialized');

      // Initialize controls
      this.initControls();
      console.log('Controls initialized');

      // Initialize components
      this.ui = new UI();
      console.log('UI initialized');

      this.socketManager = new SocketManager();
      console.log('Socket manager initialized');

      // Initialize hex grid
      this.hexGrid = new HexGrid(this.scene, 1, 17);
      console.log('Hex grid initialized');

      // In the App constructor after other initializations
      this.fpsCounter = new FPSCounter();
      console.log('FPS counter initialized');

      // Connect components
      this.connectComponents();
      console.log('Components connected');

      // Start render loop
      this.animate = this.animate.bind(this); // Bind animate to preserve 'this' context
      this.animate();
      console.log('Animation loop started');

      // Detect if we're on a mobile device
      this.isMobile = this.detectMobile();
      console.log('Mobile device detection:', this.isMobile ? 'Mobile' : 'Desktop');

      // In App constructor, after other initializations
      if (this.ui && typeof this.ui.initGameHUD === 'function') {
        this.ui.initGameHUD();
      }

      // Animation state
      this.animationsEnabled = true;

    } catch (error) {
      console.error('Error during initialization:', error);
      alert('Error initializing application: ' + error.message);
    }
  }

  /**
   * Detect if the user is on a mobile device
   * @returns {boolean} True if on mobile device
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
 * Initialize all controls (camera, keyboard, mouse/touch)
 */
  initControls() {
    // 1. CAMERA CONTROLS (from initThree)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI / 2;

    // Configure OrbitControls for our specific control scheme
    this.controls.mouseButtons = {
      LEFT: null,  // Disable left-click for OrbitControls
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE  // Right-click to rotate/pan
    };

    // Add touch gesture recognition for OrbitControls
    this.controls.touches = {
      ONE: THREE.TOUCH.ROTATE,  // One finger rotates
      TWO: THREE.TOUCH.DOLLY_PAN  // Two fingers for zoom/pan
    };

    // Add custom properties to track dragging
    this.controls.wasDragging = false;
    this.controls.isMouseDown = false;
    this.controls.isMouseMoving = false;
    this.controls.lastMoveTime = Date.now();
    this.controls.isRightMouseDown = false;
    this.controls.isTouching = false;

    // Override the update method to add our custom tracking
    const originalUpdate = this.controls.update.bind(this.controls);
    this.controls.update = () => {
      originalUpdate();

      // Reset dragging state on each frame if not actively moving
      if (!this.controls.isMouseMoving && Date.now() - this.controls.lastMoveTime > 300) {
        this.controls.wasDragging = false;
      }
    };

    // 2. KEYBOARD CONTROLS (consolidated from both methods)
    // Track keyboard state for modifiers
    this.isShiftKeyPressed = false;

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Shift') this.isShiftKeyPressed = true;

      // Terrain generation with 'T' key
      if (e.key === 't' || e.key === 'T') {
        if (e.shiftKey) {
          // Shift+T: Apply random color tints
          this.applyRandomTints();
        } else {
          // Plain T: Generate terrain
          this.generateTerrain();
        }
      }
      // Shift+O: Shift orbital center to selected hex or back to origin
      window.addEventListener('keydown', (e) => {
        // Existing key handlers...

        // Shift+O: Shift orbital center to selected hex or back to origin
        if ((e.key === 'o' || e.key === 'O') && e.shiftKey) {
          this.shiftOrbitalCenter();
        }
      });

      // Add this to your existing keydown event listener in initControls
      window.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') this.isShiftKeyPressed = true;

        // Existing key handlers...

        // Toggle FPS counter with 'F' key
        if (e.key === 'f' || e.key === 'F') {
          const isVisible = this.fpsCounter.toggle();
          if (this.ui && typeof this.ui.showToast === 'function') {
            this.ui.showToast(`FPS Counter ${isVisible ? 'enabled' : 'disabled'}`, 'info');
          }
        }

        // Other existing key handlers...
      });

      // Toggle animations with 'A' key
      if (e.key === 'a' || e.key === 'A') {
        this.toggleAnimations();
      }

      // Toggle Help HUD with 'H' key
      if (e.key === 'h' || e.key === 'H') {
        if (this.ui && this.ui.hudContainer) {
          this.ui.hudContainer.classList.toggle('hud-hidden');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.isShiftKeyPressed = false;
    });

    // 3. MOUSE/TOUCH CONTROLS (consolidated from both methods)
    // Set up mouse position tracking
    this.mouse = new THREE.Vector2();

    window.addEventListener('mousemove', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      if (this.controls.isMouseDown) {
        this.controls.isMouseMoving = true;
        this.controls.wasDragging = true;
        this.controls.lastMoveTime = Date.now();
      }
    });

    window.addEventListener('mousedown', () => {
      this.controls.isMouseDown = true;
      this.controls.lastMoveTime = Date.now();
    });

    window.addEventListener('mouseup', () => {
      this.controls.isMouseDown = false;
      this.controls.isMouseMoving = false;
    });

    // Set up touch position tracking for mobile
    window.addEventListener('touchmove', (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
      }
    });

    // Use bind to preserve 'this' context
    const handleHexClick = this.handleHexClick.bind(this);

    // Set up click handling specifically for left-click on desktop
    window.addEventListener('click', (event) => {
      // Only proceed if it's a left-click (button 0)
      if (event.button !== 0) return;

      // Make sure the click is not on a UI element
      if (event.target.closest('#ui-overlay')) return;

      // Only process if we're not in a drag operation
      if (!this.controls.wasDragging) {
        handleHexClick();
      }
    });

    // Set up touch tap handling for mobile
    window.addEventListener('touchend', (event) => {
      // Make sure the tap is not on a UI element
      if (event.target.closest('#ui-overlay')) return;

      // Only handle single-finger taps (not multi-touch gestures)
      if (event.changedTouches.length === 1) {
        // Update mouse position one last time
        const touch = event.changedTouches[0];
        this.mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        // Check if this was a tap, not a drag 
        if (!this.controls.wasDragging) {
          handleHexClick();
        }
      }
    });

    // Mouse wheel for zoom/height adjustment
    this.renderer.domElement.addEventListener('wheel', (event) => {
      // Only proceed if controls are enabled
      if (!this.controls.enabled) return;

      // Check if a hex is selected (in which case we prioritize height adjustment)
      if (this.hexGrid && this.hexGrid.selectedHex) {
        // Let the hex grid handle the scroll event for height adjustment
        const hexHandled = this.hexGrid.handleScroll(event);

        // Always prevent default and stop propagation when a hex is selected
        // to avoid camera zooming interference
        event.preventDefault();
        event.stopPropagation();

        // Disable OrbitControls zoom temporarily
        this.controls.enableZoom = false;
        return;
      } else {
        this.controls.enableZoom = true;
      }
    }, { passive: false });

    // 4. PREVENT DEFAULT BEHAVIORS
    // Disable context menu (right-click) for the application
    document.getElementById('game-container').addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Prevent scrolling when touching the canvas
    document.body.addEventListener('touchstart', (e) => {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    document.body.addEventListener('touchmove', (e) => {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });

    document.body.addEventListener('touchend', (e) => {
      if (e.target === document.querySelector('#canvas-container canvas')) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  /**
   * Initialize Three.js scene, camera, renderer, etc.
   */
  initThree() {
    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 20);
    this.camera.lookAt(0, 0, 0);

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('canvas-container').appendChild(this.renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Handle device orientation changes
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }, 200); // Small delay to allow browser to complete orientation change
    });
  }

  /**
   * Connect all components and set up callbacks
   */
  connectComponents() {
    // UI to Socket connections
    this.ui.setCreateRoomCallback(() => {
      this.socketManager.createRoom();
    });

    this.ui.setJoinRoomCallback((roomCode) => {
      this.socketManager.joinRoom(roomCode);
    });

    this.ui.setSendChatMessageCallback((roomCode, message) => {
      this.socketManager.sendChatMessage(roomCode, message);
    });

    // // In connectComponents method in main.js
    // // Connect UI refresh button to model manager refresh
    // this.ui.setRefreshModelsCallback(() => {
    //   if (this.hexGrid && this.hexGrid.voxelModelManager) {
    //     this.hexGrid.voxelModelManager.refreshModelList()
    //       .then(models => {
    //         this.ui.showToast(`Found ${models.length} models`, 'success');
    //       })
    //       .catch(err => {
    //         this.ui.showToast('Failed to refresh models', 'error');
    //       });
    //   }
    // });

    // Instead, we can auto-refresh models when creating/joining a room:
    this.socketManager.setRoomCreatedCallback((roomCode) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);

      // Update HexGrid with room code and socket manager
      this.hexGrid.setRoomCode(roomCode);
      this.hexGrid.setSocketManager(this.socketManager);

      // Auto-refresh models when entering a room
      if (this.hexGrid && this.hexGrid.voxelModelManager) {
        this.hexGrid.voxelModelManager.refreshModelList().catch(err => {
          console.warn('Failed to auto-refresh models:', err);
        });
      }
    });

    // Socket to UI connections
    this.socketManager.setRoomCreatedCallback((roomCode) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);

      // Update HexGrid with room code and socket manager
      this.hexGrid.setRoomCode(roomCode);
      this.hexGrid.setSocketManager(this.socketManager);
    });

    this.socketManager.setRoomJoinedCallback((roomCode, state) => {
      this.currentRoomCode = roomCode;
      this.ui.updateRoomDisplay(roomCode);

      // Update HexGrid with room code and socket manager
      this.hexGrid.setRoomCode(roomCode);
      this.hexGrid.setSocketManager(this.socketManager);

      // Apply the existing room state to our grid
      if (state && Object.keys(state).length > 0) {
        console.log('Applying existing room state with', Object.keys(state).length, 'hexes');

        // Apply in batches to avoid UI freezing
        const hexIds = Object.keys(state);
        const batchSize = 10;

        // Function to process a batch
        const processBatch = (startIndex) => {
          const endIndex = Math.min(startIndex + batchSize, hexIds.length);

          for (let i = startIndex; i < endIndex; i++) {
            const hexId = hexIds[i];
            const hexState = state[hexId];
            this.hexGrid.updateHexState(hexId, hexState);
          }

          // Process next batch if there are more hexes
          if (endIndex < hexIds.length) {
            setTimeout(() => processBatch(endIndex), 10);
          }
        };

        // Start processing batches
        processBatch(0);
      }
    });

    this.socketManager.setRoomErrorCallback((error) => {
      this.ui.displayError(error);
    });

    this.socketManager.setChatMessageCallback((userId, message, timestamp) => {
      this.ui.displayChatMessage(userId, message, timestamp);
    });

    this.socketManager.setHexUpdatedCallback((hexId, action) => {
      this.hexGrid.updateHexState(hexId, action);
    });
  }


  /**
   * Handle hex click and notify server
   */
  handleHexClick() {
    // Only send updates if we're in a room
    if (!this.currentRoomCode) return;

    const selectedHex = this.hexGrid.handleClick(this.mouse, this.camera);

    if (selectedHex) {
      console.log('Hex clicked:', selectedHex);

      // Check if Shift key is pressed for placing a voxel model instead of changing color
      if (this.isShiftKeyPressed) {
        console.log('Placing voxel model (Shift key pressed)');
        this.handleVoxelModelPlacement(selectedHex.hexId);
        return;
      }

      // Only send color change on first click of a hex
      // We'll check if the hex already has a custom color by looking at the mesh
      const hexMesh = this.hexGrid.hexMeshes[selectedHex.hexId];
      const hasCustomColor = hexMesh &&
        hexMesh.material &&
        hexMesh.material.color &&
        hexMesh.material.color.getHex() !== this.hexGrid.defaultMaterial.color.getHex();

      // Play animation on the model if there is one on this hex
      // Add this code to trigger animation
      if (this.hexGrid && typeof this.hexGrid.playAnimationOnHex === 'function') {
        this.hexGrid.playAnimationOnHex(selectedHex.hexId);
      }

    }
  }

  /**
 * Shift the orbital center to the selected hex or back to origin
 */
  /**
 * Shift the orbital center to the selected hex or back to origin
 * @param {boolean} animate - Whether to animate the transition
 */
  shiftOrbitalCenter(animate = true) {
    // Store the current target
    const currentTarget = this.controls.target.clone();
    let newTarget;
    let message;

    // Check if we have a selected hex
    if (this.hexGrid && this.hexGrid.selectedHex) {
      // Get the position of the selected hex
      const { q, r } = this.hexGrid.selectedHex.userData;
      const position = this.hexGrid.hexUtils.axialToPixel(q, r);

      newTarget = new THREE.Vector3(position.x, 0, -position.z);
      // message = `Camera focused on hex (${q},${r})`;
    } else {
      // If no hex is selected, reset to origin
      newTarget = new THREE.Vector3(0, 0, 0);
      // message = 'Camera reset to center';
    }

    if (animate) {
      // Animate the transition over time
      const duration = 1000; // in milliseconds
      const startTime = Date.now();

      const animateTransition = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Use easing function for smoother animation
        const easeProgress = progress < 0.5 ?
          2 * progress * progress :
          -1 + (4 - 2 * progress) * progress;

        // Interpolate between current and new target
        this.controls.target.lerpVectors(
          currentTarget,
          newTarget,
          easeProgress
        );

        this.controls.update();

        // Continue animation if not complete
        if (progress < 1) {
          requestAnimationFrame(animateTransition);
        } else {
          // Show toast when animation completes
          if (this.ui && typeof this.ui.showToast === 'function') {
            // this.ui.showToast(message, 'success');
          }
        }
      };

      // Start animation
      animateTransition();
    } else {
      // Instant transition
      this.controls.target.copy(newTarget);
      this.controls.update();

      // Show toast
      if (this.ui && typeof this.ui.showToast === 'function') {
        // this.ui.showToast(message, 'success');
      }
    }
  }

  /**
   * Handle placing a voxel model on a hex
   * @param {string} hexId - ID of the clicked hex
   */
  // Update this method in main.js
  handleVoxelModelPlacement(hexId) {
    if (!this.currentRoomCode) return;

    const hexMesh = this.hexGrid.hexMeshes[hexId];
    if (!hexMesh) return;

    const randomModelType = this.hexGrid.voxelModelManager.getRandomModelType();

    const modelOptions = {
      modelType: randomModelType,
      scale: 1.5,
      animate: true
    };

    if (this.socketManager) {
      const action = {
        voxelModel: {
          type: modelOptions.modelType,
          scale: modelOptions.scale,
          animate: modelOptions.animate
        }
      };

      this.socketManager.sendHexAction(
        this.currentRoomCode,
        hexId,
        action
      );
    }
  }

  /**
   * Generate a random hex color
   * @returns {string} Random hex color
   */
  getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /**
 * Apply random color tints to hex tops
 */
  applyRandomTints() {
    // Only apply tints if we're in a room
    if (!this.currentRoomCode || !this.socketManager) {
      console.warn('Cannot apply tints: not in a room');
      if (this.ui && typeof this.ui.showToast === 'function') {
        this.ui.showToast('Join a room first to apply tints', 'error');
      }
      return;
    }

    // Check if the hex grid has the tinting method
    if (this.hexGrid && typeof this.hexGrid.applyRandomTints === 'function') {
      // Set tint intensity - adjust this value to control how strong the tints are
      const intensity = 0.4 + Math.random() * 0.3; // 0.4-0.7

      this.hexGrid.applyRandomTints(
        this.currentRoomCode,
        this.socketManager,
        intensity
      );

      // Show a message
      if (this.ui && typeof this.ui.showToast === 'function') {
        // this.ui.showToast('Applying colorful tints...', 'success');
      }
    } else {
      console.error('Tinting method not available');
    }
  }

  /**
 * Toggle model animations on/off
 */
  toggleAnimations() {
    this.animationsEnabled = !this.animationsEnabled;

    if (this.hexGrid && this.hexGrid.voxelModelManager) {
      this.hexGrid.voxelModelManager.setAnimationsEnabled(this.animationsEnabled);
    }

    // Show a message about the current state
    const message = `Animations ${this.animationsEnabled ? 'enabled' : 'disabled'}`;
    console.log(message);

    // If UI is available, show a toast notification
    if (this.ui && typeof this.ui.showToast === 'function') {
      this.ui.showToast(message, this.animationsEnabled ? 'success' : 'info');
    }
  }

  /**
   * Animation loop
   */
  animate() {
    requestAnimationFrame(this.animate);

    // Update controls
    if (this.controls && typeof this.controls.update === 'function') {
      this.controls.update();
    }

    // Update FPS counter
    if (this.fpsCounter) {
      this.fpsCounter.update();
    }

    // Update model animations if available
    if (this.hexGrid && this.hexGrid.voxelModelManager &&
      typeof this.hexGrid.voxelModelManager.updateAnimations === 'function') {
      this.hexGrid.voxelModelManager.updateAnimations();
    }

    // Check if we're currently dragging to avoid hover effects
    const isDragging = this.controls.isRightMouseDown ||
      this.controls.wasDragging ||
      (this.controls.isTouching && this.controls.wasDragging);

    // Update hex hover state - pass dragging state to prevent hover during camera movement
    this.hexGrid.handleMouseMove(this.mouse, this.camera, isDragging);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /**
 * Generate terrain across the hex grid
 */
  generateTerrain() {
    // Only generate terrain if we're in a room
    if (!this.currentRoomCode || !this.socketManager) {
      console.warn('Cannot generate terrain: not in a room');
      if (this.ui && typeof this.ui.showToast === 'function') {
        this.ui.showToast('Join a room first to generate terrain', 'error');
      }
      return;
    }

    // Check if the hex grid has the terrain generation method
    if (this.hexGrid && typeof this.hexGrid.generateTerrain === 'function') {
      // Use consistent amplitude values, not decreasing over time
      // Can make this even higher if desired
      const scale = 0.1 + Math.random() * 0.05;  // 0.1-0.15 
      const amplitude = 7.0 + Math.random() * 2.0;  // 4.0-6.0 (increased from 2.5-3.5)
      const octaves = 3 + Math.floor(Math.random() * 2);  // 3-4

      this.hexGrid.generateTerrain(
        scale,
        amplitude,
        octaves,
        this.currentRoomCode,
        this.socketManager
      );

      // Show a message
      if (this.ui && typeof this.ui.showToast === 'function') {
        // this.ui.showToast('Generating terrain...', 'success');
      }
    } else {
      console.error('Terrain generation method not available');
    }
  }
}



// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
});