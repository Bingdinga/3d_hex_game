import * as THREE from 'three';
import { HexUtils } from './HexUtils.js';
import { VoxelModelManager } from '../models/VoxelModelManager.js';
import { NoiseGenerator } from '../utils/NoiseGenerator.js';

/**
 * HexGrid class handles creating and managing a hexagonal grid in Three.js
 */
class HexGrid {
  constructor(scene, hexSize = 1, radius = 10) {
    this.scene = scene;
    this.hexUtils = new HexUtils(hexSize);
    this.radius = radius;
    this.hexMeshes = {}; // Maps hex IDs to their meshes
    this.sphereObjects = {}; // Maps hex IDs to their sphere objects
    this.selectedHex = null;
    this.hoverHex = null;
    this.currentRoomCode = null; // We'll need to know the room code for updates
    this.socketManager = null; // Reference to socket manager for sending updates

    // Initialize voxel model components
    this.voxelModels = {}; // Maps hex IDs to their voxel model data
    this.voxelModelManager = null; // Will be initialized if VoxelModelManager exists

    // Set smaller radius for mobile devices to improve performance
    if (this.detectMobile()) {
      this.radius = Math.min(radius, 8); // Reduce radius on mobile for performance
    }

    // Create materials
    this.defaultMaterial = new THREE.MeshLambertMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    this.hoverMaterial = new THREE.MeshLambertMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });

    this.selectedMaterial = new THREE.MeshLambertMaterial({
      color: 0xe74c3c,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    // Create sphere material
    this.sphereMaterial = new THREE.MeshLambertMaterial({
      color: 0xf39c12, // Orange color for the sphere
      transparent: false,
      side: THREE.DoubleSide
    });

    // In the constructor of HexGrid class, after creating materials
    this.textureLoader = new THREE.TextureLoader();
    this.cobbleTexture = this.textureLoader.load('textures/cobble.png');
    this.cobbleTexture.wrapS = THREE.RepeatWrapping;
    this.cobbleTexture.wrapT = THREE.RepeatWrapping;

    // Create textured material for the sides of the hex columns
    this.cobbleMaterial = new THREE.MeshStandardMaterial({
      map: this.cobbleTexture,
      side: THREE.DoubleSide
    });

    // Material for the top of the hex columns
    this.cobbleTopMaterial = new THREE.MeshStandardMaterial({
      map: this.cobbleTexture,
      side: THREE.DoubleSide
    });

    // Material for the top of the hex columns
    this.cobbleTopMaterial = new THREE.MeshStandardMaterial({
      map: this.cobbleTexture,
      side: THREE.DoubleSide
    });

    // Create raycaster for hex selection
    this.raycaster = new THREE.Raycaster();

    // Initialize
    this.createGrid();

    // Initialize voxel model manager if the class exists
    this.initVoxelModelManager(scene);

    // Add scroll listener for height adjustment of selected hex
    window.addEventListener('wheel', this.handleScroll.bind(this));

    console.log('HexGrid constructor completed, voxelModelManager initialized:',
      this.voxelModelManager ? 'yes' : 'no',
      'VoxelModelManager class exists:',
      typeof VoxelModelManager !== 'undefined' ? 'yes' : 'no');
  }

  /**
   * Set the socket manager reference
   * @param {SocketManager} socketManager - Reference to socket manager
   */
  setSocketManager(socketManager) {
    this.socketManager = socketManager;
  }

  /**
 * Generate terrain using noise
 * @param {number} scale - Scale of the noise pattern (higher = more zoomed in)
 * @param {number} amplitude - Maximum height of the terrain
 * @param {number} octaves - Number of noise layers (more = more detail)
 * @param {string} roomCode - Current room code for syncing
 * @param {SocketManager} socketManager - Socket manager for syncing
 */
  generateTerrain(scale = 0.1, amplitude = 3.0, octaves = 4, roomCode, socketManager) {
    if (!roomCode || !socketManager) return;

    // Create noise generator with a random seed
    const noiseGen = new NoiseGenerator(Math.random() * 1000);

    // Generate peaks
    const peakCount = 1 + Math.floor(Math.random() * 2);
    const peakPoints = [];
    const gridRadius = this.radius * 1.5;

    for (let i = 0; i < peakCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (0.3 + Math.random() * 0.5) * gridRadius;
      peakPoints.push({
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
      });
    }

    const peakHeight = 3.0 + Math.random() * 2.0;
    const peakWidth = 3.0 + Math.random() * 2.0;

    // Process all hexes in batches
    const hexIds = Object.keys(this.hexMeshes);
    const batchSize = 20;

    const processBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, hexIds.length);

      for (let i = startIndex; i < endIndex; i++) {
        const hexId = hexIds[i];
        const hex = this.hexMeshes[hexId];
        const { q, r } = hex.userData;

        // Generate height using noise
        const noiseValue = noiseGen.fractalNoise(q * scale, r * scale, octaves);
        let height = 0.25 + noiseValue * amplitude;

        // Add peak influence
        const peakInfluence = noiseGen.createPeaks(q, r, peakPoints, peakHeight, peakWidth);
        height += peakInfluence;

        // Round to nearest 0.25
        const roundedHeight = Math.round(height * 4) / 4;

        // Create action with height change
        const action = {
          height: roundedHeight
        };

        // Preserve existing color if it exists
        if (hex.userData.customColor) {
          action.color = '#' + hex.userData.customColor.getHexString();
        } else if (hex.material && hex.material[0] && hex.material[0].color) {
          action.color = '#' + hex.material[0].color.getHexString();
        }

        // Send to server
        socketManager.sendHexAction(roomCode, hexId, action);
      }

      // Process next batch if there are more hexes
      if (endIndex < hexIds.length) {
        setTimeout(() => processBatch(endIndex), 50);
      }
    };

    // Start processing batches
    processBatch(0);
  }

  /**
 * Apply a random color tint to the top of each hex
 * @param {string} roomCode - Current room code for syncing
 * @param {SocketManager} socketManager - Socket manager for syncing
 * @param {number} intensity - Tint intensity between 0 and 1
 */
  /**
 * Apply a single color tint to all hexes
 * @param {string} roomCode - Current room code for syncing
 * @param {SocketManager} socketManager - Socket manager for syncing
 * @param {number} intensity - Tint intensity between 0 and 1
 */
  applyRandomTints(roomCode, socketManager, intensity = 0.7) {
    if (!roomCode || !socketManager) return;
    if (!this.hexMeshes || Object.keys(this.hexMeshes).length === 0) return;

    // Generate ONE random color for all hexes
    const hue = Math.random();
    const saturation = 0.5 + Math.random() * 0.5;
    const lightness = 0.1 + Math.random() * 0.2;
    const tintColor = new THREE.Color();
    tintColor.setHSL(hue, saturation, lightness);

    // Process all hexes in batches
    const hexIds = Object.keys(this.hexMeshes);
    const batchSize = 20;

    const processBatch = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, hexIds.length);

      for (let i = startIndex; i < endIndex; i++) {
        const hexId = hexIds[i];
        const hex = this.hexMeshes[hexId];

        // Get current color
        let currentColor;
        if (hex.userData.customColor) {
          currentColor = hex.userData.customColor.clone();
        } else if (Array.isArray(hex.material) && hex.material[0] && hex.material[0].color) {
          currentColor = hex.material[0].color.clone();
        } else if (hex.material && hex.material.color) {
          currentColor = hex.material.color.clone();
        } else {
          currentColor = new THREE.Color(0x3498db);
        }

        // Blend the colors
        const blendedColor = new THREE.Color(
          currentColor.r * (1 - intensity) + tintColor.r * intensity,
          currentColor.g * (1 - intensity) + tintColor.g * intensity,
          currentColor.b * (1 - intensity) + tintColor.b * intensity
        );

        // Apply color directly to hex
        if (Array.isArray(hex.material)) {
          if (hex.material[0]) {
            hex.material[0].color.copy(blendedColor);
          }
        } else if (hex.material) {
          hex.material.color.copy(blendedColor);
        }

        // Store the new color
        hex.userData.customColor = blendedColor.clone();

        // Create action
        const action = {
          color: '#' + blendedColor.getHexString(),
          height: hex.userData.height
        };

        // Send to server
        socketManager.sendHexAction(roomCode, hexId, action);
      }

      // Process next batch
      if (endIndex < hexIds.length) {
        setTimeout(() => processBatch(endIndex), 50);
      }
    };

    processBatch(0);
  }

  /**
   * Set the current room code
   * @param {string} roomCode - Current room code
   */
  setRoomCode(roomCode) {
    this.currentRoomCode = roomCode;
  }

  /**
   * Initialize the voxel model manager
   * @param {THREE.Scene} scene - The scene to add models to
   */
  initVoxelModelManager(scene) {
    // Skip if we've already initialized
    if (this.voxelModelManager) return;

    // Check if VoxelModelManager exists
    if (typeof VoxelModelManager === 'undefined') {
      console.error('VoxelModelManager class not available! Check script loading order.');
      return;
    }

    try {
      // Create the manager
      this.voxelModelManager = new VoxelModelManager(scene);
      console.log('Voxel model manager initialized successfully:', this.voxelModelManager);
    } catch (error) {
      console.error('Error initializing voxel model manager:', error);
      this.voxelModelManager = null;
    }
  }

  /**
 * Handle scroll wheel events to adjust selected hex height
 * @param {WheelEvent} event - Mouse wheel event
 * @returns {boolean} - Whether the event was handled by this method
 */
  handleScroll(event) {
    // Only proceed if we have a selected hex
    if (!this.selectedHex || !this.currentRoomCode || !this.socketManager) return false;

    // Always handle the scroll event when there's a selected hex, regardless of where it happened
    // This ensures that camera zoom is disabled while a hex is selected

    // Get current height or default to 1
    const currentHeight = this.selectedHex.userData.height || 1;

    // Calculate new height based on scroll direction
    // Use smaller increments for finer control
    const direction = event.deltaY > 0 ? -1 : 1;
    const heightChange = 0.25 * direction;
    let newHeight = Math.max(0.25, currentHeight + heightChange);

    // Round to nearest 0.25 for cleaner values
    newHeight = Math.round(newHeight * 4) / 4;

    // Only update if height actually changed
    if (newHeight !== currentHeight) {
      // Create action with just the height change
      const action = {
        height: newHeight
      };

      // Send to server
      this.socketManager.sendHexAction(
        this.currentRoomCode,
        this.selectedHex.userData.hexId,
        action
      );
    }

    // Always return true when we have a selected hex to prevent camera zooming
    return true;
  }

  /**
   * Detect if the user is on a mobile device
   * @returns {boolean} True if on mobile device
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  /**
   * Create the hexagonal grid
   */
  createGrid() {
    const hexes = this.hexUtils.getHexesInRadius(0, 0, this.radius);

    // Process each hex in the grid
    hexes.forEach(hex => {
      const { q, r } = hex;
      const hexId = this.hexUtils.getHexId(q, r);

      // Create hexagon shape
      const corners = this.hexUtils.getHexCorners(q, r);
      const hexShape = new THREE.Shape();

      // Move to first corner
      hexShape.moveTo(corners[0].x, corners[0].z);

      // Draw lines to each corner
      for (let i = 1; i < corners.length; i++) {
        hexShape.lineTo(corners[i].x, corners[i].z);
      }

      // Close the shape
      hexShape.lineTo(corners[0].x, corners[0].z);

      // Create geometry from shape
      const geometry = new THREE.ShapeGeometry(hexShape);

      // Rotate to lie flat on xz plane
      geometry.rotateX(-Math.PI / 2);

      // Create mesh with textured material
      const material = this.cobbleTopMaterial.clone();
      const mesh = new THREE.Mesh(geometry, material);

      // Position slightly above the ground plane to avoid z-fighting
      mesh.position.y = 0.01;

      // Store hex data
      mesh.userData = { q, r, hexId, height: 0.01 };

      // Add to scene and store reference
      this.scene.add(mesh);
      this.hexMeshes[hexId] = mesh;
    });
  }

  /**
   * Handle mouse/touch movement for hex highlighting
   * @param {THREE.Vector2} pointerPosition - Normalized mouse/touch position
   * @param {THREE.Camera} camera - Current camera
   * @param {boolean} isDragging - Whether we are currently in a drag operation
   */
  handleMouseMove(pointerPosition, camera, isDragging = false) {
    // Skip hover effects completely for mobile devices and during dragging
    if (this.detectMobile() || isDragging) {
      // Clear any existing hover state
      if (this.hoverHex && this.hoverHex !== this.selectedHex) {
        if (Array.isArray(this.hoverHex.material)) {
          // For multi-material meshes, restore texture to top face
          this.hoverHex.material[0] = this.cobbleTopMaterial.clone();
        } else {
          // Single material fallback
          this.hoverHex.material = this.cobbleTopMaterial.clone();
        }
        this.hoverHex = null;
      }
      return null;
    }

    this.raycaster.setFromCamera(pointerPosition, camera);

    // Find intersections
    const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));

    // Clear previous hover (but not if it's the selected hex)
    if (this.hoverHex && this.hoverHex !== this.selectedHex) {
      if (Array.isArray(this.hoverHex.material)) {
        // For multi-material meshes, restore texture to top face
        this.hoverHex.material[0] = this.cobbleTopMaterial.clone();

        // If this hex has a custom color, apply it
        if (this.hoverHex.userData.customColor) {
          this.hoverHex.material[0].color.set(this.hoverHex.userData.customColor);
        }
      } else {
        // Single material fallback
        this.hoverHex.material = this.cobbleTopMaterial.clone();

        // If this hex has a custom color, apply it
        if (this.hoverHex.userData.customColor) {
          this.hoverHex.material.color.set(this.hoverHex.userData.customColor);
        }
      }
    }

    // Set new hover - but only on desktop
    if (intersects.length > 0) {
      const hex = intersects[0].object;

      if (hex !== this.selectedHex) {
        if (Array.isArray(hex.material)) {
          // For multi-material meshes, apply hover color to top face
          // Save current color first if needed
          if (!hex.userData.customColor && hex.material[0].color) {
            hex.userData.customColor = hex.material[0].color.clone();
          }

          // Apply hover color
          hex.material[0].color.copy(this.hoverMaterial.color);
        } else {
          // Save current color first if needed
          if (!hex.userData.customColor && hex.material.color) {
            hex.userData.customColor = hex.material.color.clone();
          }

          // Apply hover material
          hex.material = this.hoverMaterial.clone();
        }
        this.hoverHex = hex;
      }

      return hex;
    }

    this.hoverHex = null;
    return null;
  }

  /**
 * Handle mouse click or touch tap for hex selection
 * @param {THREE.Vector2} pointerPosition - Normalized mouse/touch position
 * @param {THREE.Camera} camera - Current camera
 * @returns {Object|null} Selected hex data or null if no hex was clicked
 */
  handleClick(pointerPosition, camera) {
    this.raycaster.setFromCamera(pointerPosition, camera);

    // Add some tolerance for touch input
    if (this.detectMobile()) {
      this.raycaster.params.Line.threshold = 0.1;
      this.raycaster.params.Points.threshold = 0.1;
    }

    // Find intersections
    const intersects = this.raycaster.intersectObjects(Object.values(this.hexMeshes));

    // Clear previous selection visual (but maintain selected hex)
    if (this.selectedHex) {
      if (Array.isArray(this.selectedHex.material)) {
        // For multi-material meshes, restore texture to top face
        this.selectedHex.material[0] = this.cobbleTopMaterial.clone();

        // If this hex has a custom color, apply it
        if (this.selectedHex.userData.customColor) {
          this.selectedHex.material[0].color.set(this.selectedHex.userData.customColor);
        }
      } else {
        // Single material fallback
        this.selectedHex.material = this.cobbleTopMaterial.clone();

        // If this hex has a custom color, apply it
        if (this.selectedHex.userData.customColor) {
          this.selectedHex.material.color.set(this.selectedHex.userData.customColor);
        }
      }
    }

    // If we clicked on a hex, select it
    if (intersects.length > 0) {
      const hex = intersects[0].object;

      // Apply selection material
      if (Array.isArray(hex.material)) {
        // For multi-material meshes, set selection color on top face
        // Save current color first if needed
        if (!hex.userData.customColor && hex.material[0].color) {
          hex.userData.customColor = hex.material[0].color.clone();
        }

        // Apply selection color
        hex.material[0].color.copy(this.selectedMaterial.color);
      } else {
        // Save current color first if needed
        if (!hex.userData.customColor && hex.material.color) {
          hex.userData.customColor = hex.material.color.clone();
        }

        // Apply selection material
        hex.material = this.selectedMaterial.clone();
      }
      this.selectedHex = hex;

      // Return the hex data with preserved height
      return {
        hexId: hex.userData.hexId,
        q: hex.userData.q,
        r: hex.userData.r,
        height: hex.userData.height || 0.01 // Preserve height information
      };
    } else {
      // If we clicked elsewhere, clear selection
      this.selectedHex = null;
      return null;
    }
  }

  /**
   * Play a random animation on a hex's model if available
   * @param {string} hexId - ID of the hex
   */
  playAnimationOnHex(hexId) {
    if (this.voxelModelManager && this.voxelModelManager.animationClips[hexId]) {
      // Play a random animation for 3 seconds
      this.voxelModelManager.playRandomAnimation(hexId, 3);

      // Log available animations for this model
      const animations = this.voxelModelManager.listAnimations(hexId);
      if (animations.length > 0) {
        console.log(`Playing one of ${animations.length} available animations for hex ${hexId} for 3 seconds`);
      }
    }
  }

  /**
   * Update a hex's appearance based on its state
   * @param {string} hexId - Hex ID
   * @param {Object} state - New state data
   */
  updateHexState(hexId, state) {
    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Keep track of selection state
    const wasSelected = hex === this.selectedHex;
    const wasHover = hex === this.hoverHex;

    // Apply color change if specified
    if (state.color) {
      const newColor = new THREE.Color(state.color);
      hex.userData.customColor = newColor.clone();

      // Apply color to materials
      if (Array.isArray(hex.material)) {
        hex.material[0].color.copy(newColor);
      } else {
        hex.material.color.copy(newColor);
      }
    }

    if (state.height !== undefined) {
      hex.userData.height = state.height;
      this.extrudeHex(hex, state.height);

      // Update the model position immediately after updating the hex
      this.updateVoxelModel(hexId);
    }

    // Handle voxel model data if present
    if (state.voxelModel) {
      const modelOptions = {
        modelType: state.voxelModel.type,
        scale: state.voxelModel.scale || 1.5,
        rotation: state.voxelModel.rotation || { x: 0, y: 0, z: 0 },
        animate: state.voxelModel.animate !== undefined ? state.voxelModel.animate : true,
        hoverRange: state.voxelModel.hoverRange || 0.2,
        hoverSpeed: state.voxelModel.hoverSpeed || 1.0,
        rotateSpeed: state.voxelModel.rotateSpeed || 0.5,
        hexHeight: hex.userData.height || 0
      };

      if (this.voxelModelManager) {
        this.voxelModelManager.removeModel(hexId);
      }

      if (modelOptions.modelType) {
        this.spawnVoxelModelOnHex(hexId, modelOptions);
      }
    } else if (heightChanged) {
      // If only height changed but we have an existing model, update its position
      this.updateVoxelModel(hexId);
    }
  }

  /**
   * Extrude a hex to create a 3D column
   * @param {THREE.Mesh} hexMesh - The hex mesh to extrude
   * @param {number} height - The height to extrude to
   */
  extrudeHex(hexMesh, height) {
    const { q, r } = hexMesh.userData;
    const hexId = hexMesh.userData.hexId;

    // Store selection state and material
    const wasSelected = hexMesh === this.selectedHex;
    const wasHover = hexMesh === this.hoverHex;

    // Get current color - check various places the color might be stored
    let currentColor;

    // First check userData for stored custom color
    if (hexMesh.userData.customColor) {
      currentColor = hexMesh.userData.customColor.clone();
    }
    // Then check the top material if it's a multi-material mesh
    else if (Array.isArray(hexMesh.material) && hexMesh.material[0] && hexMesh.material[0].color) {
      currentColor = hexMesh.material[0].color.clone();
    }
    // Finally check if it's a single material
    else if (hexMesh.material && hexMesh.material.color) {
      currentColor = hexMesh.material.color.clone();
    }
    // Default fallback
    else {
      currentColor = new THREE.Color(0x3498db);
    }

    // Remove old mesh
    this.scene.remove(hexMesh);

    // Create corners
    const corners = this.hexUtils.getHexCorners(q, r);

    // Create extruded geometry
    const shape = new THREE.Shape();
    shape.moveTo(corners[0].x, corners[0].z);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x, corners[i].z);
    }
    shape.lineTo(corners[0].x, corners[0].z);

    // Extrusion settings
    const extrudeSettings = {
      steps: 1,
      depth: height,
      bevelEnabled: false
    };

    // Create extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Rotate to correct orientation (extrude along Y axis)
    geometry.rotateX(-Math.PI / 2);

    // Create materials array for different faces
    const sideMaterial = this.cobbleMaterial.clone();

    // Create top material with preserved color
    const topMaterial = this.cobbleTopMaterial.clone();
    topMaterial.color.copy(currentColor);

    // Create materials array - index 0 is top face, index 1 is sides
    const materials = [topMaterial, sideMaterial];

    // Create mesh with material array
    const newMesh = new THREE.Mesh(geometry, materials);

    // Copy user data, including height AND store color
    newMesh.userData = {
      q,
      r,
      hexId,
      height,
      customColor: currentColor.clone() // Important: Store the color in userData
    };

    // Add to scene
    this.scene.add(newMesh);

    // Store reference to replace the old one
    this.hexMeshes[hexId] = newMesh;

    // Restore selection state if needed
    if (wasSelected) {
      this.selectedHex = newMesh;
    }

    if (wasHover) {
      this.hoverHex = newMesh;
    }

    this.updateVoxelModelPosition(hexId);

    // Ensure models update with the new hex height
    if (this.voxelModels[hexId]) {
      this.updateVoxelModelPosition(hexId);
    }
  }

  /**
 * Spawn a voxel model on a hex
 * @param {string} hexId - ID of the hex to place the model on
 * @param {Object} options - Options for the model
 * @returns {THREE.Object3D} The model instance
 */
  spawnVoxelModelOnHex(hexId, options = {}) {
    if (!this.voxelModelManager) {
      console.warn('Cannot spawn voxel model: voxel model manager not initialized');
      return null;
    }

    const hex = this.hexMeshes[hexId];
    if (!hex) return null;

    // Remove any existing model first
    this.removeVoxelModel(hexId);

    // Ensure hex height is a number
    const hexHeight = typeof hex.userData.height === 'number' ? hex.userData.height : 0;

    // Use a consistent height offset
    const heightOffset = options.heightOffset || 1.0;

    // Create base options
    const modelOptions = {
      heightOffset: heightOffset,
      scale: options.scale || 1.5,
      animate: options.animate !== undefined ? options.animate : true,
      hoverRange: options.hoverRange || 0.2,
      hoverSpeed: options.hoverSpeed || 1.0,
      rotateSpeed: options.rotateSpeed || 0.5,
      hexHeight: hexHeight  // Make sure this is set correctly
    };

    // Set model path
    if (options.modelType) {
      modelOptions.modelPath = `models/${options.modelType}.glb`;
    } else if (options.modelPath) {
      modelOptions.modelPath = options.modelPath;
    } else {
      return null;
    }

    // Add rotation if specified
    if (options.rotation) {
      modelOptions.rotation = options.rotation;
    }

    // Calculate base position (without the offset)
    const position = this.hexUtils.getObjectPosition(
      hex.userData.q,
      hex.userData.r,
      hexHeight // Don't add offset here
    );

    // Store the model data including height offset for position updates
    this.voxelModels[hexId] = {
      heightOffset: heightOffset,
      animate: modelOptions.animate,
      hoverRange: modelOptions.hoverRange,
      hoverSpeed: modelOptions.hoverSpeed,
      rotateSpeed: modelOptions.rotateSpeed,
      hexHeight: hexHeight
    };

    // Create the model with explicit y-position
    const positionWithOffset = position.clone();
    positionWithOffset.y = position.y + heightOffset;

    console.log(`Spawning model at hex ${hexId} with height ${hexHeight} and offset ${heightOffset}`);

    return this.voxelModelManager.placeModelAt(hexId, positionWithOffset, modelOptions);
  }

  /**
   * Update a voxel model's position when its hex changes height
   * @param {string} hexId - ID of the hex
   */
  updateVoxelModelPosition(hexId) {
    // Skip if we don't have this model
    if (!this.voxelModels[hexId]) return;

    const hex = this.hexMeshes[hexId];
    if (!hex) return;

    // Get the stored height offset
    const heightOffset = this.voxelModels[hexId].heightOffset || 0.5;

    // Ensure the hex height is a number and not undefined
    const hexHeight = typeof hex.userData.height === 'number' ? hex.userData.height : 0;

    // Calculate new position - use the hex utils to get the correct world position
    const position = this.hexUtils.getObjectPosition(
      hex.userData.q,
      hex.userData.r,
      hexHeight // Don't add offset here, we'll handle that in updateModelHeight
    );

    // Log for debugging
    console.log(`Updating model position for hex ${hexId}. Hex height: ${hexHeight}, Offset: ${heightOffset}`);

    // Update model position with both position and height information
    if (this.voxelModelManager) {
      this.voxelModelManager.updateModelHeight(hexId, position, hexHeight, heightOffset);
    }
  }

  /**
   * Remove a voxel model from a hex
   * @param {string} hexId - ID of the hex
   */
  removeVoxelModel(hexId) {
    if (this.voxelModelManager) {
      this.voxelModelManager.removeModel(hexId);
    }

    if (this.voxelModels[hexId]) {
      delete this.voxelModels[hexId];
    }
  }

  /**
   * Update voxel model when hex state changes
   * This should be called from updateHexState
   * @param {string} hexId - ID of the hex
   */
  updateVoxelModel(hexId) {
    // Only update if we have a model on this hex
    if (this.voxelModels[hexId]) {
      this.updateVoxelModelPosition(hexId);
    }
  }

}

export { HexGrid };