import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * VoxelModelManager handles loading, caching, and managing 3D models for the hex grid
 */
class VoxelModelManager {
  constructor(scene) {
    console.log('VoxelModelManager constructor called');
    this.scene = scene;
    this.models = {};     // Active model instances by hexId
    this.modelCache = {}; // Cache for loaded models
    this.availableModels = []; // Add this line to store available models

    this.animationMixers = {};  // Stores animation mixers by hexId
    this.animationActions = {}; // Stores animation actions by hexId
    this.animationClips = {};   // Stores available animation clips by hexId

    // Create a GLTFLoader instance
    this.gltfLoader = new GLTFLoader();

    // Create a simple fallback geometry
    this.fallbackGeometry = new THREE.BoxGeometry(1, 1, 1);

    this.animatedModels = {}; // Track models that should be animated
    this.clock = new THREE.Clock(); // For timing animations

    this.pendingModelRequests = {}; // Add this line to track pending requests

    // Fetch available models when manager is created
    this.fetchAvailableModels().catch(err => {
      console.warn('Failed to fetch initial model list:', err);
    });

  }

  /**
   * Load a model from file
   * @param {string} modelPath - Path to the model file
   * @returns {Promise} Promise that resolves with the loaded model
   */
  // In VoxelModelManager.js, find the loadModel method

  loadModel(modelPath) {
    // Check if model is already in cache
    if (this.modelCache[modelPath]) {
      // Clone the cached model
      const model = this.modelCache[modelPath].clone();

      // Clone animation clips if they exist
      let animationClips = [];
      if (this.modelCache[modelPath].userData.animations) {
        animationClips = this.modelCache[modelPath].userData.animations.map(clip => clip.clone());
      }

      return Promise.resolve({
        model: model,
        isFirstLoad: false,
        animations: animationClips
      });
    }

    // Load the model
    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        modelPath,
        (gltf) => {
          console.log(`Model ${modelPath} loaded successfully (first time)`);

          this.modelCache[modelPath] = gltf.scene;

          // Store animation clips in the model's userData for future cloning
          if (gltf.animations && gltf.animations.length > 0) {
            this.modelCache[modelPath].userData.animations = gltf.animations;
          }

          // Resolve with a NEW clone and animation data
          resolve({
            model: gltf.scene.clone(), // Use a fresh clone to avoid duplicates
            isFirstLoad: true,
            animations: gltf.animations || []
          });
        },
        (progress) => {
          console.log(`Loading ${modelPath}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
        },
        (error) => {
          console.error(`Error loading model ${modelPath}:`, error);
          reject(error);
        }
      );
    });
  }


  // Add this method to VoxelModelManager.js
  ensureModelReadyForAnimation(model, hexId, options) {
    console.log(`Ensuring model for hex ${hexId} is ready for animation`);

    // Make sure model has proper traversal state
    if (model.traverse) {
      model.traverse(child => {
        if (child.isMesh) {
          child.matrixAutoUpdate = true;
        }
      });
    }

    // Force an initial position update
    model.position.y = options.initialY + 0.0001; // Tiny offset to force update
    model.updateMatrixWorld(true);

    // If this is the first time this model type is used, make a note
    const modelType = options.modelPath || 'fallback';
    if (!this._initializedModelTypes) this._initializedModelTypes = {};

    if (!this._initializedModelTypes[modelType]) {
      console.log(`First time seeing model type: ${modelType}`);
      this._initializedModelTypes[modelType] = true;

      // Force a matrix update on the entire scene
      this.scene.updateMatrixWorld(true);
    }
  }

  /**
   * Place a model at a position
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - Position to place the model
   * @param {Object} options - Options for the model
   */
  // Simplify placeModelAt:
  async placeModelAt(hexId, position, options = {}) {
    console.log(`Placing model at hex ${hexId}`);

    this.removeModel(hexId);

    try {
      let model;

      if (options.modelPath) {
        const loadResult = await this.loadModel(options.modelPath);
        const loadedModel = loadResult.model;

        model = this.centerModelOrigin(loadedModel);

        const bbox = new THREE.Box3().setFromObject(model);
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        const normalizedScale = 1 / maxDim;
        const scale = options.scale || 1.5;
        model.scale.set(
          normalizedScale * scale,
          normalizedScale * scale,
          normalizedScale * scale
        );

        model.position.copy(position);

        if (options.rotation) {
          model.rotation.x = options.rotation.x || 0;
          model.rotation.y = options.rotation.y || 0;
          model.rotation.z = options.rotation.z || 0;
        }

        model.userData.hexId = hexId;

        this.scene.add(model);
        model.updateMatrix();
        model.updateMatrixWorld(true);
      } else {
        // Use fallback if no model path is specified
        const material = new THREE.MeshStandardMaterial({
          color: Math.random() * 0xffffff
        });
        model = new THREE.Mesh(this.fallbackGeometry, material);

        const scale = options.scale || 1.5;
        model.scale.set(scale, scale, scale);
      }

      model.userData.hexId = hexId;
      this.models[hexId] = model;

      if (options.animate) {
        this.animatedModels[hexId] = {
          model: model,
          initialY: position.y,
          hoverRange: options.hoverRange || 0.2,
          hoverSpeed: options.hoverSpeed || 1.0,
          rotateSpeed: options.rotateSpeed || 0.5
        };
      }

      return model;
    } catch (error) {
      console.error('Error placing model:', error);
      return this.placeFallbackModel(hexId, position, options);
    }
  }

  updateModelHeight(hexId, position, hexHeight, heightOffset) {
    const model = this.models[hexId];
    if (!model) return;

    // Create a new position object with the correct Y value
    const newPosition = position.clone();

    // Apply the height offset to the y-coordinate
    newPosition.y = position.y + (heightOffset || 0);

    // Update the position
    model.position.copy(newPosition);

    // For debug
    console.log(`Model at hex ${hexId} position updated to:`, newPosition);

    // Update animation data if this model is animated
    if (this.animatedModels[hexId]) {
      // Store both the base position Y and the actual height for animations
      this.animatedModels[hexId].initialY = newPosition.y;
      this.animatedModels[hexId].hexHeight = hexHeight;
      this.animatedModels[hexId].heightOffset = heightOffset || 0;

      // Reset animation timing to avoid jumps
      if (this.animatedModels[hexId].hoverRange > 0) {
        // Force position update to ensure smooth transition
        model.position.y = newPosition.y;
        model.updateMatrix();
        model.updateMatrixWorld(true);
      }
    }
  }

  /**
   * Place a fallback cube model as a backup
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - Position to place the model
   * @param {Object} options - Options for the model
   */
  placeFallbackModel(hexId, position, options = {}) {
    const scale = options.scale || 1.5;
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff
    });

    const mesh = new THREE.Mesh(this.fallbackGeometry, material);

    // Apply position
    mesh.position.copy(position);

    // Apply scale
    mesh.scale.set(scale, scale, scale);

    // Apply rotation if specified
    if (options.rotation) {
      mesh.rotation.x = options.rotation.x || 0;
      mesh.rotation.y = options.rotation.y || 0;
      mesh.rotation.z = options.rotation.z || 0;
    }

    // Add to scene
    this.scene.add(mesh);

    // Store reference
    this.models[hexId] = mesh;

    return mesh;
  }

  /**
   * Update a model's position
   * @param {string} hexId - ID of the hex
   * @param {THREE.Vector3} position - New position
   */
  updateModelPosition(hexId, position) {
    const model = this.models[hexId];
    if (model) {
      model.position.copy(position);
    }
  }

  // Add these methods to VoxelModelManager.js

  /**
   * Fetch available models from the server
   * @returns {Promise<string[]>} Array of available model names
   */
  async fetchAvailableModels() {
    try {
      const response = await fetch('/api/models');
      const data = await response.json();

      if (data.models && Array.isArray(data.models)) {
        // Store the list of available models
        this.availableModels = data.models;
        console.log('Available models:', this.availableModels);
        return this.availableModels;
      } else {
        console.error('Invalid response format from /api/models');
        return [];
      }
    } catch (error) {
      console.error('Error fetching available models:', error);
      return [];
    }
  }

  /**
   * Get a random model type from available models
   * @returns {string} Random model type
   */
  getRandomModelType() {
    if (!this.availableModels || this.availableModels.length === 0) {
      // Default list if models haven't been fetched yet
      return 'voxel_lucky_cat';
    }

    const randomIndex = Math.floor(Math.random() * this.availableModels.length);
    return this.availableModels[randomIndex];
  }

  updateAnimations() {
    // Skip all animation updates if animations are disabled
    if (this.animationsEnabled === false) return;

    const deltaTime = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // Update animation mixers
    Object.keys(this.animationMixers).forEach(hexId => {
      this.animationMixers[hexId].update(deltaTime);
    });

    // Update each animated model
    Object.keys(this.animatedModels).forEach(hexId => {
      const animData = this.animatedModels[hexId];
      if (!animData || !animData.model) return;

      // Check if this is the first animation update
      if (!animData.initialized) {
        // Force model to its initial position before starting animations
        animData.model.position.y = animData.initialY;
        animData.model.updateMatrixWorld(true);
        animData.initialized = true;
      }

      // Apply animations
      if (animData.hoverRange > 0) {
        animData.model.position.y = animData.initialY +
          Math.sin(time * animData.hoverSpeed) * animData.hoverRange;
      }

      if (animData.rotateSpeed > 0) {
        animData.model.rotation.y += deltaTime * animData.rotateSpeed;
      }

      // Ensure matrix is updated after changes
      animData.model.updateMatrix();
    });
  }

  /**
 * Enable or disable all model animations
 * @param {boolean} enabled - Whether animations should be enabled
 */
  setAnimationsEnabled(enabled) {
    // Store the global animation state
    this.animationsEnabled = enabled;

    // If animations are disabled, reset all models to their base position
    if (!enabled) {
      Object.keys(this.animatedModels).forEach(hexId => {
        const animData = this.animatedModels[hexId];
        if (!animData || !animData.model) return;

        // Reset to initial position
        animData.model.position.y = animData.initialY;

        // Stop rotation by ensuring we don't accumulate further changes
        // but keep the current rotation value
        animData.pausedRotationY = animData.model.rotation.y;
      });
    } else {
      // When re-enabling, we can let the normal animation update take over
      // but we need to ensure the clock doesn't cause a sudden jump
      this.resetClock();
    }
  }

  /**
 * Play a specific animation on a model
 * @param {string} hexId - ID of the hex with the model
 * @param {number|string} animationIndex - Index or name of animation to play
 * @param {number} duration - Duration to play in seconds (0 = play full animation)
 * @returns {boolean} Success status
 */
  playAnimation(hexId, animationIndex, duration = 0) {
    // Check if we have animations for this model
    if (!this.animationClips[hexId] || !this.animationMixers[hexId]) {
      console.warn(`No animations available for hex ${hexId}`);
      return false;
    }

    // Stop any currently playing animations
    if (this.animationActions[hexId]) {
      this.animationActions[hexId].stop();
    }

    // Get the animation clip
    let clip;
    if (typeof animationIndex === 'number') {
      // Get by index
      clip = this.animationClips[hexId][animationIndex];
    } else if (typeof animationIndex === 'string') {
      // Get by name
      clip = this.animationClips[hexId].find(c => c.name === animationIndex);
    }

    if (!clip) {
      console.warn(`Animation ${animationIndex} not found for hex ${hexId}`);
      return false;
    }

    // Create and play the animation action
    const action = this.animationMixers[hexId].clipAction(clip);

    // Configure the action based on duration
    if (duration > 0) {
      // Set the animation to play once (not loop)
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true; // Stay at final position when done

      // Set up a timer to stop the animation after the specified duration
      setTimeout(() => {
        if (this.animationActions[hexId] === action) {
          action.fadeOut(0.5); // Smooth fade out over 0.5 seconds

          // Clear the action reference after fade out
          setTimeout(() => {
            if (this.animationActions[hexId] === action) {
              this.animationActions[hexId] = null;
            }
          }, 500);
        }
      }, duration * 1000);
    } else {
      // If no duration specified, play normally (usually looping)
      action.setLoop(THREE.LoopRepeat);
    }

    action.reset();
    action.play();

    // Store the action
    this.animationActions[hexId] = action;

    console.log(`Playing animation "${clip.name}" on hex ${hexId}${duration > 0 ? ` for ${duration} seconds` : ''}`);
    return true;
  }

  /**
 * Play a random animation on a model
 * @param {string} hexId - ID of the hex with the model
 * @param {number} duration - Duration to play in seconds (0 = play full animation)
 * @returns {boolean} Success status
 */
  playRandomAnimation(hexId, duration = 0) {
    // Check if we have animations for this model
    if (!this.animationClips[hexId] || this.animationClips[hexId].length === 0) {
      console.warn(`No animations available for hex ${hexId}`);
      return false;
    }

    // Select a random animation
    const randomIndex = Math.floor(Math.random() * this.animationClips[hexId].length);
    return this.playAnimation(hexId, randomIndex, duration);
  }

  /**
   * List all available animations for a model
   * @param {string} hexId - ID of the hex with the model
   * @returns {Array} Array of animation names and details
   */
  listAnimations(hexId) {
    if (!this.animationClips[hexId]) {
      console.warn(`No animations available for hex ${hexId}`);
      return [];
    }

    const animations = this.animationClips[hexId].map((clip, index) => ({
      index,
      name: clip.name,
      duration: clip.duration
    }));

    console.log(`Animations for hex ${hexId}:`, animations);
    return animations;
  }

  /**
   * Remove a model from a hex
   * @param {string} hexId - ID of the hex
   */
  removeModel(hexId) {
    if (this.models[hexId]) {
      // Make sure to call scene.remove to remove it from the scene
      this.scene.remove(this.models[hexId]);

      // Clean up animation resources
      if (this.animationMixers[hexId]) {
        this.animationMixers[hexId].stopAllAction();
        delete this.animationMixers[hexId];
      }

      if (this.animationActions[hexId]) {
        delete this.animationActions[hexId];
      }

      if (this.animationClips[hexId]) {
        delete this.animationClips[hexId];
      }

      // Clean up other resources
      delete this.animatedModels[hexId];
      delete this.models[hexId];
    }
  }

  // Add this method to VoxelModelManager.js

  /**
   * Refresh the list of available models
   * @returns {Promise<string[]>} Updated list of models
   */
  async refreshModelList() {
    console.log('Refreshing model list...');
    return this.fetchAvailableModels();
  }

  /**
 * Centers a model's origin point to its geometric center
 * @param {THREE.Object3D} model - The model to center
 * @returns {THREE.Object3D} The centered model
 */
  centerModelOrigin(model) {
    // Calculate the bounding box of the model
    const bbox = new THREE.Box3().setFromObject(model);

    // Calculate the center of the bounding box
    const center = bbox.getCenter(new THREE.Vector3());

    // Create a parent container
    const container = new THREE.Object3D();

    // Add model to container
    container.add(model);

    // Offset the model within the container to center its origin
    model.position.sub(center);

    // Store the original center for reference if needed
    container.userData.originalCenter = center.clone();

    return container;
  }

  resetClock() {
    this.clock = new THREE.Clock();
  }

  ensureModelInitialized(model) {
    // Make sure all child objects have matrix auto updates enabled
    model.traverse(child => {
      if (child.isMesh) {
        child.matrixAutoUpdate = true;
      }
    });

    // Force a matrix update on the model
    model.updateMatrix();
    model.updateMatrixWorld(true);
  }


  // Add this method to VoxelModelManager.js
  logModelInfo() {
    console.log('-------- Voxel Model Manager Status --------');
    console.log(`Active models: ${Object.keys(this.models).length}`);
    console.log(`Animated models: ${Object.keys(this.animatedModels).length}`);
    console.log(`Model cache entries: ${Object.keys(this.modelCache).length}`);

    // List all active models
    console.log('Active model placements:');
    Object.entries(this.models).forEach(([hexId, model]) => {
      console.log(`  Hex ${hexId}: ${model.userData.instanceId || 'unknown'}`);
    });
  }

}

export { VoxelModelManager };