import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Consider adding TextGeometry or Sprites for axis labels later if needed
// import { FontLoader } from 'three/addons/loaders/FontLoader.js';
// import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// --- Configuration ---
const POINT_RADIUS = 0.1;
const AXIS_LENGTH = 3;
const ARC_SEGMENTS = 64; // Resolution for arcs
const INITIAL_POINT_POS = new THREE.Vector3(1.5, 1, 1.2);

// --- Global Variables ---
let sceneCartesian, cameraCartesian, rendererCartesian, controlsCartesian;
let sceneSpherical, cameraSpherical, rendererSpherical, controlsSpherical;

let interactivePointMesh, pointMeshSpherical; // The visible point markers
let currentPoint = new THREE.Vector3().copy(INITIAL_POINT_POS); // Master position

// Visual Aids (store references to update them)
let lineOriginToPointC, lineXProjC, lineYProjC, lineZProjC; // Cartesian lines
let lineOriginToPointS, arcThetaS, arcPhiS; // Spherical visuals

// DOM Elements
const cartesianContainer = document.getElementById('cartesian-canvas-container');
const sphericalContainer = document.getElementById('spherical-canvas-container');
const cartesianCoordsDiv = document.getElementById('cartesian-coords');
const sphericalCoordsDiv = document.getElementById('spherical-coords');

// --- Math Helpers ---
function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

function cartesianToSpherical(x, y, z) {
    const r = Math.sqrt(x*x + y*y + z*z);
    if (r === 0) {
        return { r: 0, theta: 0, phi: 0 };
    }
    // Theta (polar angle): Angle from positive Z axis (0 to PI)
    const theta = Math.acos(THREE.MathUtils.clamp(z / r, -1, 1)); // Clamp avoids potential floating point issues at poles
    // Phi (azimuthal angle): Angle in XY plane from positive X axis (-PI to PI)
    const phi = Math.atan2(y, x);
    return { r, theta, phi };
}

// --- Initialization ---
function init() {
    // === Cartesian Scene Setup ===
    sceneCartesian = new THREE.Scene();
    sceneCartesian.background = new THREE.Color(0xffffff);

    cameraCartesian = new THREE.PerspectiveCamera(60, cartesianContainer.clientWidth / cartesianContainer.clientHeight, 0.1, 100);
    cameraCartesian.position.set(3, 3, 4);
    cameraCartesian.lookAt(0, 0, 0);

    rendererCartesian = new THREE.WebGLRenderer({ antialias: true });
    rendererCartesian.setSize(cartesianContainer.clientWidth, cartesianContainer.clientHeight);
    rendererCartesian.setPixelRatio(window.devicePixelRatio);
    cartesianContainer.appendChild(rendererCartesian.domElement);

    controlsCartesian = new OrbitControls(cameraCartesian, rendererCartesian.domElement);
    controlsCartesian.enablePan = false; // Disable panning
    controlsCartesian.target.set(0, 0, 0);
    controlsCartesian.update();

    // === Spherical Scene Setup ===
    sceneSpherical = new THREE.Scene();
    sceneSpherical.background = new THREE.Color(0xffffff); // Keep background same for consistency

    cameraSpherical = new THREE.PerspectiveCamera(60, sphericalContainer.clientWidth / sphericalContainer.clientHeight, 0.1, 100);
    cameraSpherical.position.set(3, 3, 4); // Start with same view
    cameraSpherical.lookAt(0, 0, 0);

    rendererSpherical = new THREE.WebGLRenderer({ antialias: true });
    rendererSpherical.setSize(sphericalContainer.clientWidth, sphericalContainer.clientHeight);
    rendererSpherical.setPixelRatio(window.devicePixelRatio);
    sphericalContainer.appendChild(rendererSpherical.domElement);

    controlsSpherical = new OrbitControls(cameraSpherical, rendererSpherical.domElement);
    controlsSpherical.enablePan = false; // Disable panning
    controlsSpherical.target.set(0, 0, 0);
    controlsSpherical.update();

    // --- Lighting (same for both) ---
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    sceneCartesian.add(ambientLight.clone());
    sceneSpherical.add(ambientLight.clone());

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 0.5).normalize();
    sceneCartesian.add(directionalLight.clone());
    sceneSpherical.add(directionalLight.clone());


    // --- Create Coordinate Systems ---
    createCartesianSystemVisuals(sceneCartesian);
    createSphericalSystemVisuals(sceneSpherical); // Mostly axes for reference

    // --- Create the Interactive Point ---
    const pointGeometry = new THREE.SphereGeometry(POINT_RADIUS, 32, 16);
    const pointMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.5 }); // Red point

    interactivePointMesh = new THREE.Mesh(pointGeometry, pointMaterial);
    interactivePointMesh.position.copy(currentPoint);
    sceneCartesian.add(interactivePointMesh);

    // Create the point marker for the spherical scene (will follow currentPoint)
    pointMeshSpherical = new THREE.Mesh(pointGeometry, pointMaterial.clone()); // Use same appearance
    pointMeshSpherical.position.copy(currentPoint);
    sceneSpherical.add(pointMeshSpherical);

    // --- Create Visual Aids ---
    createCartesianVisualAids(sceneCartesian);
    createSphericalVisualAids(sceneSpherical);

    // --- Setup Drag Controls ---
    setupDragInteraction();

    // --- Initial Update ---
    updateVisuals();

    // --- Event Listeners ---
    window.addEventListener('resize', onWindowResize);

    // --- Start Animation Loop ---
    animate();
}

// --- Coordinate System Visuals ---
function createCartesianSystemVisuals(scene) {
    const axesHelper = new THREE.AxesHelper(AXIS_LENGTH);
    axesHelper.material.linewidth = 2; // Note: May not work on all platforms (ANGLE/Windows)
    scene.add(axesHelper);

    // Optional: Grid Helper
    // const gridHelper = new THREE.GridHelper(AXIS_LENGTH * 2, AXIS_LENGTH * 2, 0xcccccc, 0xdddddd);
    // scene.add(gridHelper);

    // TODO: Add Axis Labels (X, Y, Z) using Sprites or TextGeometry for better clarity
}

function createSphericalSystemVisuals(scene) {
    // Use AxesHelper for reference, maybe slightly different color/style if desired
    const axesHelper = new THREE.AxesHelper(AXIS_LENGTH);
     axesHelper.material.linewidth = 2;
    axesHelper.material.transparent = true;
    axesHelper.material.opacity = 0.5; // Make them fainter
    scene.add(axesHelper);

    // Optional: Add a wireframe sphere to hint at the spherical nature
    // const sphereGeom = new THREE.SphereGeometry(AXIS_LENGTH, 16, 8);
    // const sphereWireframe = new THREE.WireframeGeometry(sphereGeom);
    // const sphereMat = new THREE.LineBasicMaterial({ color: 0xaaaaaa, linewidth: 1, transparent: true, opacity: 0.3 });
    // const sphereLines = new THREE.LineSegments(sphereWireframe, sphereMat);
    // scene.add(sphereLines);
}

// --- Visual Aid Creation ---
function createCartesianVisualAids(scene) {
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue lines
    const dashedMaterial = new THREE.LineDashedMaterial({
        color: 0x666666, // Grey dashed lines
        linewidth: 1,
        scale: 1,
        dashSize: 0.1,
        gapSize: 0.05,
    });

    // Line from Origin to Point
    let geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), currentPoint]);
    lineOriginToPointC = new THREE.Line(geometry, lineMaterial);
    scene.add(lineOriginToPointC);

    // Projection Lines (X, Y, Z axes) - Use dashed lines
    geometry = new THREE.BufferGeometry().setFromPoints([currentPoint, new THREE.Vector3(currentPoint.x, currentPoint.y, 0)]);
    lineZProjC = new THREE.Line(geometry, dashedMaterial);
    lineZProjC.computeLineDistances(); // Required for dashed lines
    scene.add(lineZProjC);

    // Projections onto XY plane axes need intermediate point P_xy = (x, y, 0)
    const P_xy = new THREE.Vector3(currentPoint.x, currentPoint.y, 0);
    geometry = new THREE.BufferGeometry().setFromPoints([P_xy, new THREE.Vector3(currentPoint.x, 0, 0)]);
    lineYProjC = new THREE.Line(geometry, dashedMaterial);
    lineYProjC.computeLineDistances();
    scene.add(lineYProjC);

    geometry = new THREE.BufferGeometry().setFromPoints([P_xy, new THREE.Vector3(0, currentPoint.y, 0)]);
    lineXProjC = new THREE.Line(geometry, dashedMaterial);
    lineXProjC.computeLineDistances();
    scene.add(lineXProjC);

     // Add lines along axes from origin to projection points (optional, can be cluttered)
}

function createSphericalVisualAids(scene) {
    const radiusMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red for radius (r)
    const thetaMaterial = new THREE.LineBasicMaterial({ color: 0x00cc00 }); // Green for theta (θ)
    const phiMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue for phi (φ)

    // --- Radius Line (r) ---
    let geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), currentPoint]);
    lineOriginToPointS = new THREE.Line(geometry, radiusMaterial);
    scene.add(lineOriginToPointS);

    // --- Theta Arc (θ) ---
    // Draw an arc from the +Z axis downwards towards the point, in the plane defined by Z and the point.
    const thetaPoints = [];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
        thetaPoints.push(new THREE.Vector3()); // Placeholder points
    }
    geometry = new THREE.BufferGeometry().setFromPoints(thetaPoints);
    arcThetaS = new THREE.Line(geometry, thetaMaterial);
    scene.add(arcThetaS);

    // --- Phi Arc (φ) ---
    // Draw an arc in the XY plane from the +X axis towards the point's XY projection.
    const phiPoints = [];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
        phiPoints.push(new THREE.Vector3()); // Placeholder points
    }
    geometry = new THREE.BufferGeometry().setFromPoints(phiPoints);
    arcPhiS = new THREE.Line(geometry, phiMaterial);
    scene.add(arcPhiS);
}


// --- Update Logic ---
function updateVisuals() {
    // Update point positions
    interactivePointMesh.position.copy(currentPoint);
    pointMeshSpherical.position.copy(currentPoint);

    // Calculate Spherical Coordinates
    const { x, y, z } = currentPoint;
    const spherical = cartesianToSpherical(x, y, z);
    const { r, theta, phi } = spherical;

    // === Update Cartesian Visual Aids ===
    const positionsC = lineOriginToPointC.geometry.attributes.position;
    positionsC.setXYZ(1, x, y, z);
    positionsC.needsUpdate = true;

    // Z-Projection line (Point to XY plane)
    const positionsZProj = lineZProjC.geometry.attributes.position;
    positionsZProj.setXYZ(0, x, y, z);
    positionsZProj.setXYZ(1, x, y, 0);
    positionsZProj.needsUpdate = true;
    lineZProjC.computeLineDistances(); // Recompute for dashed lines

    // Intermediate point P_xy = (x, y, 0)
    const P_xy = new THREE.Vector3(x, y, 0);

    // Y-Projection line (P_xy to XZ plane point (x,0,0)) - actually point on X axis
    const positionsYProj = lineYProjC.geometry.attributes.position;
    positionsYProj.setXYZ(0, P_xy.x, P_xy.y, P_xy.z);
    positionsYProj.setXYZ(1, x, 0, 0);
    positionsYProj.needsUpdate = true;
    lineYProjC.computeLineDistances();

    // X-Projection line (P_xy to YZ plane point (0,y,0)) - actually point on Y axis
    const positionsXProj = lineXProjC.geometry.attributes.position;
    positionsXProj.setXYZ(0, P_xy.x, P_xy.y, P_xy.z);
    positionsXProj.setXYZ(1, 0, y, 0);
    positionsXProj.needsUpdate = true;
    lineXProjC.computeLineDistances();


    // === Update Spherical Visual Aids ===
    const positionsS = lineOriginToPointS.geometry.attributes.position;
    positionsS.setXYZ(1, x, y, z);
    positionsS.needsUpdate = true;

    // Theta Arc (from +Z down)
    const thetaPositions = arcThetaS.geometry.attributes.position;
    const tempSpherical = new THREE.Spherical();
    const tempVec = new THREE.Vector3();
    tempSpherical.radius = r;
    tempSpherical.phi = phi; // Keep phi constant for the theta arc plane
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const ratio = i / ARC_SEGMENTS;
        tempSpherical.theta = ratio * theta; // Interpolate theta from 0 to final theta
        tempVec.setFromSpherical(tempSpherical);
        thetaPositions.setXYZ(i, tempVec.x, tempVec.y, tempVec.z);
    }
    thetaPositions.needsUpdate = true;
    arcThetaS.geometry.setDrawRange(0, r > 1e-6 ? ARC_SEGMENTS + 1 : 0); // Hide if at origin


    // Phi Arc (in XY plane from +X)
    const phiPositions = arcPhiS.geometry.attributes.position;
    const radiusXY = Math.sqrt(x*x + y*y);
    // Use ArcCurve for simpler calculation
    const phiCurve = new THREE.ArcCurve(0, 0, radiusXY, 0, phi, false); // Use the calculated phi directly
    const phiPoints = phiCurve.getPoints(ARC_SEGMENTS);
     for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const point = phiPoints[i] || phiPoints[ARC_SEGMENTS-1]; // Handle potential off-by-one
        if (point) {
            phiPositions.setXYZ(i, point.x, point.y, 0); // Set Z to 0 for XY plane
        } else {
             phiPositions.setXYZ(i, 0,0,0); // Fallback
        }
    }
    phiPositions.needsUpdate = true;
     arcPhiS.geometry.setDrawRange(0, radiusXY > 1e-6 ? ARC_SEGMENTS + 1 : 0); // Hide if at origin or on Z axis


    // === Update Text Labels ===
    cartesianCoordsDiv.innerHTML = `x: ${x.toFixed(3)}<br>y: ${y.toFixed(3)}<br>z: ${z.toFixed(3)}`;
    sphericalCoordsDiv.innerHTML = `r: ${r.toFixed(3)}<br>&theta;: ${theta.toFixed(3)} rad (${radToDeg(theta).toFixed(1)}&deg;)<br>&phi;: ${phi.toFixed(3)} rad (${radToDeg(phi).toFixed(1)}&deg;)`;
}


// --- Interaction ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isDragging = false;
const dragPlane = new THREE.Plane();
const intersectionPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();

function setupDragInteraction() {
    // Use the renderer's canvas for events
    rendererCartesian.domElement.addEventListener('pointerdown', onPointerDown);
    // Add listeners to window to catch moves/ups outside the canvas while dragging
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    // Handle pointer leaving the window during drag
    // document.addEventListener('pointerout', (event) => { if (!event.relatedTarget) onPointerUp(event); });
}

function updatePointer(event) {
    // Calculate pointer position in normalized device coordinates (-1 to +1)
    const rect = rendererCartesian.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerDown(event) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, cameraCartesian);
    const intersects = raycaster.intersectObject(interactivePointMesh);

    if (intersects.length > 0) {
        isDragging = true;
        controlsCartesian.enabled = false; // Disable camera controls during drag
        document.body.style.cursor = 'grabbing'; // Change cursor

        // Define the dragging plane: parallel to the camera view, passing through the clicked point
        cameraCartesian.getWorldDirection(dragPlane.normal).negate(); // Plane normal points towards camera
        dragPlane.setFromNormalAndCoplanarPoint(dragPlane.normal, intersects[0].point);

        // Calculate the offset from the intersection point to the object's center
        dragOffset.copy(intersects[0].point).sub(interactivePointMesh.position);
    }
}

function onPointerMove(event) {
    if (!isDragging) return;

    updatePointer(event);
    raycaster.setFromCamera(pointer, cameraCartesian);

    // Find where the mouse ray intersects the drag plane
    if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
        // Move the point to the intersection point, adjusted by the initial offset
        currentPoint.copy(intersectionPoint.sub(dragOffset));
        updateVisuals(); // Update everything based on the new position
    }
}

function onPointerUp(event) {
    if (isDragging) {
        isDragging = false;
        controlsCartesian.enabled = true; // Re-enable camera controls
        document.body.style.cursor = 'grab'; // Restore cursor
    }
}


// --- Window Resize ---
function onWindowResize() {
    // Cartesian
    const cartesianWidth = cartesianContainer.clientWidth;
    const cartesianHeight = cartesianContainer.clientHeight;
    cameraCartesian.aspect = cartesianWidth / cartesianHeight;
    cameraCartesian.updateProjectionMatrix();
    rendererCartesian.setSize(cartesianWidth, cartesianHeight);

    // Spherical
    const sphericalWidth = sphericalContainer.clientWidth;
    const sphericalHeight = sphericalContainer.clientHeight;
    cameraSpherical.aspect = sphericalWidth / sphericalHeight;
    cameraSpherical.updateProjectionMatrix();
    rendererSpherical.setSize(sphericalWidth, sphericalHeight);
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Update controls (needed for damping, etc.)
    controlsCartesian.update();
    controlsSpherical.update();

    // Render scenes
    rendererCartesian.render(sceneCartesian, cameraCartesian);
    rendererSpherical.render(sceneSpherical, cameraSpherical);
}

// --- Start ---
init();