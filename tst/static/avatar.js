// Avatar implementation using Three.js
import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { GLTFLoader } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';

class Avatar {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with id ${containerId} not found.`);
            return;
        }
        this.avatar = null;
        this.init();
    }

    init() {
        // Set up scene
        this.scene = new THREE.Scene();

        // Set up camera
        this.camera = new THREE.PerspectiveCamera(
            50,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        // Adjusted camera for better framing of the smaller robot
        this.camera.position.set(0, 0.3, 1.0);

        // Set up renderer with transparent background
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Add improved lighting for a dramatic effect
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
        this.scene.add(hemisphereLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(-5, 5, 5);
        keyLight.castShadow = true;
        this.scene.add(keyLight);
        
        const fillLight = new THREE.PointLight(0x6366F1, 0.8, 100);
        fillLight.position.set(5, 2, 3);
        this.scene.add(fillLight);

        // Initialize controls but keep them disabled for a static view
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 0.8, 0); // Point camera towards the robot's upper body
        this.controls.enabled = false; // <<< THIS DISABLES ALL MOUSE MOVEMENT

        // Load avatar
        this.loadAvatar();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.clock = new THREE.Clock();
        this.animate();
    }

async loadAvatar() {
    const loader = new GLTFLoader();
    const modelUrl = '/static/ftmod.glb';

    try {
        const gltf = await this.loadModel(loader, modelUrl);
        const model = gltf.scene;

        // Compute bounding box
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Center the model
        model.position.sub(center); // moves pivot to (0,0,0)

        // Scale to fit nicely (optional: make largest dimension ~2 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        const scaleFactor = 2.0 / maxDim;
        model.scale.setScalar(scaleFactor);

        // Reset position (slightly lift if needed)
        model.position.y -= size.y * 0.5 * scaleFactor;

        // Shadows
        model.traverse(node => {
            if (node.isMesh) node.castShadow = true;
        });

        this.avatar = {
            model: model,
            mixer: new THREE.AnimationMixer(model),
            animations: gltf.animations,
            currentAction: null
        };

        this.scene.add(model);

        // Adjust camera to frame model
        this.camera.position.set(0, size.y * 0.5 * scaleFactor, 3);
        this.controls.target.set(0, size.y * 0.5 * scaleFactor, 0);

        this.playAnimation("Scene");
    } catch (error) {
        console.error('Error loading avatar:', error);
    }
}


    loadModel(loader, url) {
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, undefined, reject);
        });
    }

    playAnimation(animationName, loop = true) {
        if (!this.avatar) return;

        const animation = this.avatar.animations.find(anim => anim.name.toLowerCase().includes(animationName.toLowerCase()));
        if (!animation) {
            console.warn(`Animation "${animationName}" not found.`);
            return;
        }

        const newAction = this.avatar.mixer.clipAction(animation);
        
        if (this.avatar.currentAction && this.avatar.currentAction !== newAction) {
            this.avatar.currentAction.fadeOut(0.5);
        }
        
        newAction.reset();
        newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        newAction.clampWhenFinished = !loop;
        newAction.enabled = true;
        newAction.fadeIn(0.5).play();

        this.avatar.currentAction = newAction;
    }

    async performConversation(text, analysisResult) {
        if (!this.avatar) return;
        const messageQueue = [];
        
        messageQueue.push({
            text: "Let me analyze this text for you.",
            animation: "Wave"
        });

        let resultMessage = "";
        let emotion = "";
        
        switch(analysisResult) {
            case 'hate_speech':
                resultMessage = "I have detected hate speech. This language is harmful and unacceptable.";
                emotion = "Angry";
                break;
            case 'offensive_language':
                resultMessage = "This content seems to contain offensive language. It might be inappropriate for some audiences.";
                emotion = "Sad";
                break;
            case 'neither':
                resultMessage = "This content appears to be safe. Everything looks good!";
                emotion = "Happy";
                break;
        }

        messageQueue.push({
            text: resultMessage,
            animation: emotion
        });

        for (const message of messageQueue) {
            await this.speakAndAnimate(message.text, message.animation);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async speakAndAnimate(text, animation) {
        return new Promise((resolve) => {
            this.playAnimation(animation, false);
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => {
                this.playAnimation("Idle");
                resolve();
            };
            
            speechSynthesis.speak(utterance);
        });
    }

    onWindowResize() {
        if (!this.container) return;
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const delta = this.clock.getDelta();
        if (this.avatar && this.avatar.mixer) {
            this.avatar.mixer.update(delta);
        }
        
        // No need to update controls as they are disabled
        // this.controls.update(); 

        this.renderer.render(this.scene, this.camera);
    }
}

export default Avatar;