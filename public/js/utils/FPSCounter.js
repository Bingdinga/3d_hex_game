/**
 * Simple FPS counter utility for performance monitoring
 */
class FPSCounter {
    constructor() {
        this.fps = 0;
        this.frames = 0;
        this.lastTime = performance.now();
        this.visible = false;

        this.initDOMElements();
    }

    /**
     * Initialize DOM elements for displaying FPS
     */
    initDOMElements() {
        // Create container element
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '10px';
        this.container.style.right = '10px';
        this.container.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        this.container.style.color = '#fff';
        this.container.style.padding = '5px 10px';
        this.container.style.borderRadius = '4px';
        this.container.style.fontFamily = 'monospace';
        this.container.style.fontSize = '14px';
        this.container.style.zIndex = '1000';
        this.container.style.display = 'none'; // Hidden by default

        // Create FPS text element
        this.fpsText = document.createElement('div');
        this.fpsText.textContent = 'FPS: 0';

        this.container.appendChild(this.fpsText);
        document.body.appendChild(this.container);
    }

    /**
     * Update FPS calculation
     */
    update() {
        this.frames++;

        const currentTime = performance.now();
        const elapsed = currentTime - this.lastTime;

        // Update FPS every 500ms
        if (elapsed >= 500) {
            this.fps = Math.round((this.frames * 1000) / elapsed);
            this.fpsText.textContent = `FPS: ${this.fps}`;

            // Reset counters
            this.frames = 0;
            this.lastTime = currentTime;
        }
    }

    /**
     * Toggle visibility of the FPS counter
     * @returns {boolean} New visibility state
     */
    toggle() {
        this.visible = !this.visible;
        this.container.style.display = this.visible ? 'block' : 'none';
        return this.visible;
    }

    /**
     * Show the FPS counter
     */
    show() {
        this.visible = true;
        this.container.style.display = 'block';
    }

    /**
     * Hide the FPS counter
     */
    hide() {
        this.visible = false;
        this.container.style.display = 'none';
    }
}

export { FPSCounter };