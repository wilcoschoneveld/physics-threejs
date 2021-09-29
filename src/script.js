import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module'
import * as dat from 'dat.gui'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

/**
 * Debug
 */
const gui = new dat.GUI()

const guiParams = {
    addSphere: () => addSphere(),
    addBox: () => addBox(),
    reset: () => reset(),
    addBox10: () => {
        for (let i = 0; i < 10; i++) {
            addBox();
        }
    }
}

gui.add(guiParams, 'addSphere');
gui.add(guiParams, 'addBox');
gui.add(guiParams, 'addBox10');
gui.add(guiParams, 'reset');

/**
 * Base
 */
// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

/**
 * Textures
 */
const textureLoader = new THREE.TextureLoader()
const cubeTextureLoader = new THREE.CubeTextureLoader()

const environmentMapTexture = cubeTextureLoader.load([
    '/textures/environmentMaps/0/px.png',
    '/textures/environmentMaps/0/nx.png',
    '/textures/environmentMaps/0/py.png',
    '/textures/environmentMaps/0/ny.png',
    '/textures/environmentMaps/0/pz.png',
    '/textures/environmentMaps/0/nz.png'
])

/**
 * Test sphere
 */
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
const sphereGeometry = new THREE.SphereGeometry(1, 32, 32)
const sphereMaterial = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    envMap: environmentMapTexture
})

const objects = []

const addSphere = () => {
    const newSphere = new THREE.Mesh(
        sphereGeometry,
        sphereMaterial
    )
    const radius = Math.random() * 0.15 + 0.05
    newSphere.scale.set(radius, radius, radius)
    newSphere.castShadow = true
    newSphere.position.x = Math.random() * 4 - 2
    newSphere.position.y = 3
    newSphere.position.z = Math.random() * 4 - 2
    scene.add(newSphere)
    objects.push(newSphere)
    worker.postMessage({
        operation: 'add_sphere',
        position: newSphere.position,
        radius
    })
}

const addBox = () => {
    const newBox = new THREE.Mesh(
        boxGeometry,
        sphereMaterial
    )
    const width = Math.random() * 0.3 + 0.05
    const height = Math.random() * 0.3 + 0.05
    const depth = Math.random() * 0.3 + 0.05
    newBox.scale.set(width, height, depth)
    newBox.castShadow = true
    newBox.position.x = Math.random() * 4 - 2
    newBox.position.y = 3
    newBox.position.z = Math.random() * 4 - 2
    scene.add(newBox)
    objects.push(newBox)
    worker.postMessage({
        operation: 'add_box',
        position: newBox.position,
        width,
        height,
        depth
    })
}

const reset = () => {
    objects.forEach(object => {
        scene.remove(object);
    })
    objects.length = 0;
    worker.postMessage({
        operation: 'reset',
    })
}

/**
 * Floor
 */
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({
        color: '#777777',
        metalness: 0.3,
        roughness: 0.4,
        // envMap: environmentMapTexture
    })
)
floor.receiveShadow = true
floor.rotation.x = - Math.PI * 0.5
scene.add(floor)

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
directionalLight.castShadow = true
directionalLight.shadow.mapSize.set(1024, 1024)
directionalLight.shadow.camera.far = 15
directionalLight.shadow.camera.left = - 7
directionalLight.shadow.camera.top = 7
directionalLight.shadow.camera.right = 7
directionalLight.shadow.camera.bottom = - 7
directionalLight.position.set(5, 5, 5)
scene.add(directionalLight)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.set(- 3, 3, 3)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.xr.enabled = true;

const controller = renderer.xr.getController(0);
controller.addEventListener('select', guiParams.addBox);
controller.addEventListener('squeeze', guiParams.addBox10);

const controller2 = renderer.xr.getController(1);
controller2.addEventListener('select', guiParams.addSphere);
controller2.addEventListener('squeeze', guiParams.reset);

/**
 * Animate
 */
const clock = new THREE.Clock()

const stats = Stats()
document.body.appendChild(stats.dom)
document.body.appendChild( VRButton.createButton( renderer ) );

renderer.setAnimationLoop(() => 
{
    const elapsedTime = clock.getElapsedTime()

    // Update physics
    syncPhysics();

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)
    stats.update()
})

const worker = new Worker(new URL('./worker.js', import.meta.url));

let positions = new Float32Array(1000 * 3);
let quaternions = new Float32Array(1000 * 4);
let count = 0;
let updateFrame = false;

worker.onmessage = (message) => {
    if (message.data.operation === "update_frame") {
        positions = message.data.positions;
        quaternions = message.data.quaternions;
        count = message.data.count;
        updateFrame = true;
    }
}

const requestPhysicsFrame = () => {
    worker.postMessage({
        operation: 'request_frame',
        positions,
        quaternions,
    }, [positions.buffer, quaternions.buffer]);
}

const syncPhysics = () => {
    if (updateFrame) {
        for (let i = 0; i < Math.min(count, objects.length); i++) {
            objects[i].position.set(
                positions[i * 3 + 0],
                positions[i * 3 + 1],
                positions[i * 3 + 2]
            );
            objects[i].quaternion.set(
                quaternions[i * 4 + 0],
                quaternions[i * 4 + 1],
                quaternions[i * 4 + 2],
                quaternions[i * 4 + 3]
            )
        }

        updateFrame = false;
        requestPhysicsFrame();
    }
}

addSphere();
requestPhysicsFrame();
