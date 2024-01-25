//IMPORT MODULES
import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import GUI from "lil-gui";
import { LoopSubdivision } from "./LoopSubdivision.js";
import { CSG } from "./THREE-CSGMesh/dist/client/CSGMesh.js";

//CONSTANT & VARIABLES

const iterations = 1;

const params = {
  split: true, // optional, default: true
  uvSmooth: false, // optional, default: false
  preserveEdges: false, // optional, default: false
  flatOnly: false, // optional, default: false
  maxTriangles: Infinity, // optional, default: Infinity
};

//-- WINDOW
let width = window.innerWidth;
let height = window.innerHeight;

//-- GUI
var gui;
var widthController;
var heightController;
var depthController;

//-- GUI PARAMETER

const parameters = {
  width: 0,
  height: 0,
  depth: 0,
  fileName: "exported_Model",
  Board() {
    createBoard();
  },
  Beam() {
    createBeam();
  },
  Bar() {
    createBar();
  },
  Joint() {
    createJoint();
  },
  delete() {
    deleteTransformedObject();
  },
  export() {
    exportScene();
  },
  move() {
    moveMode();
  },
  rotate() {
    rotateMode();
  },
};

//-- SCENE VARIABLES
var scene;
var camera;
var renderer;
var container;
var orbit;
var control;
var ambientLight;
var directionalLight;

//-- EXPORTER VARIABLES
const exporterOptions = { binary: true };
var exporter;

//-- RAYCASTER VARIABLES
let group;
let selectedObject = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
var transformedObject = null;

//-- GEOMETRY PARAMETERS
//Create an empty array for storing all the cubes
let sceneObjects = [];
let boardCounter = 1;
let beamCounter = 1;
let barCounter = 1;
let jointCounter = 1;
let jointGroup;

//-----------------------------------------------------------------------------------
// LANDING PAGE
//----------------------------------------------------------------------------------

// Create landing page dynamically
const landingPage = document.createElement("div");
landingPage.id = "landing-page";
landingPage.style.position = "absolute";
landingPage.style.top = "0";
landingPage.style.left = "0";
landingPage.style.right = "0";
landingPage.style.bottom = "0";
landingPage.style.display = "flex";
landingPage.style.flexDirection = "column";
landingPage.style.alignItems = "center";
landingPage.style.justifyContent = "center";
landingPage.style.textAlign = "center";
landingPage.style.color = "#333";
landingPage.style.backgroundColor = "white";

const title = document.createElement("h1");
title.id = "title";
title.innerText = "ReFurnish3d";
title.style.fontSize = "24px";
title.style.color = "black";
title.style.border = "none";
title.style.borderRadius = "5px";
title.style.marginTop = "20px";
title.style.fontFamily = "Moirai One, Josefin Sans, Arial, sans-serif";

const createProjectButton = document.createElement("button");
createProjectButton.id = "create-project-button";
createProjectButton.innerText = "Create new project";
createProjectButton.style.padding = "15px 30px";
createProjectButton.style.fontSize = "18px";
createProjectButton.style.cursor = "pointer";
createProjectButton.style.backgroundColor = "#333";
createProjectButton.style.color = "white";
createProjectButton.style.border = "none";
createProjectButton.style.borderRadius = "5px";
createProjectButton.style.marginTop = "20px";
createProjectButton.onclick = showProject;

landingPage.appendChild(title);
landingPage.appendChild(createProjectButton);
document.body.appendChild(landingPage);

const threejsContainer = document.createElement("div");
threejsContainer.id = "threejs-container";
threejsContainer.style.display = "none";
document.body.appendChild(threejsContainer);

function showProject() {
  landingPage.style.display = "none";
  threejsContainer.style.display = "block";
  //exportButton.style.display = "block";
  gui.domElement.style.display = "block";
}

//-----------------------------------------------------------------------------------
// MAIN
//-----------------------------------------------------------------------------------
function main() {
  //GUI
  gui = new GUI();

  //Add Objects
  const addObjectFolder = gui.addFolder("Add Objects");
  addObjectFolder.add(parameters, "Board");
  addObjectFolder.add(parameters, "Beam");
  addObjectFolder.add(parameters, "Bar");
  addObjectFolder.add(parameters, "Joint");

  //Add Object Settings
  const selectedObjectFolder = gui.addFolder("Selected Object");
  selectedObjectFolder.add(parameters, "move");
  selectedObjectFolder.add(parameters, "rotate");
  widthController = selectedObjectFolder.add(parameters, "width");
  heightController = selectedObjectFolder.add(parameters, "height");
  depthController = selectedObjectFolder.add(parameters, "depth");
  selectedObjectFolder.add(parameters, "delete");

  //Add Export
  const exportFolder = gui.addFolder("Export");
  exportFolder.add(parameters, "fileName");
  exportFolder.add(parameters, "export");

  //set Controller Value
  widthController.setValue(null);
  heightController.setValue(null);
  depthController.setValue(null);

  //CREATE SCENE AND CAMERA
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(15, width / height, 0.1, 2000);
  camera.position.set(200, 100, 170);

  //LIGHTINGS
  ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(2, 5, 5);
  directionalLight.target.position.set(-1, -1, 0);
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  //GEOMETRY INITIATION
  // Create Base Grid
  createGrid();

  //CREATE A RENDERER
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container = document.querySelector("#threejs-container");
  let canvas = renderer.domElement;
  container.append(renderer.domElement);

  //RESPONSIVE WINDOW
  window.addEventListener("resize", handleResize);
  document.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", upKey);

  //RAYCASTER
  group = new THREE.Group();
  jointGroup = new THREE.Group();
  scene.add(group);
  scene.add(jointGroup);
  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.minDistance = 2;
  orbit.maxDistance = 1000;

  //Exporter
  exporter = new STLExporter();

  //Transform selected Objects
  widthController.onFinishChange(function (v) {
    if (transformedObject != null) {
      transformedObject.scale.x =
        parameters.width / transformedObject.geometry.parameters.width;
    }
  });

  heightController.onFinishChange(function (v) {
    if (transformedObject != null) {
      transformedObject.scale.y =
        parameters.width / transformedObject.geometry.parameters.width;
    }
  });

  depthController.onFinishChange(function (v) {
    if (transformedObject != null) {
      transformedObject.scale.z =
        parameters.width / transformedObject.geometry.parameters.width;
    }
  });

  control = new TransformControls(camera, renderer.domElement);
  //Die folgende Zeile lässt iwie alles ruckeln???

  //control.addEventListener("change", animate);

  control.addEventListener("dragging-changed", function (event) {
    orbit.enabled = !event.value;
  });
  control.setMode("translate");
  control.setTranslationSnap(1);
  control.setSize(1.2);

  //Create export Button
  //createButton("export", "export", 20, exportScene());

  //EXECUTE THE UPDATE
  animate();
}

//-----------------------------------------------------------------------------------
//HELPER FUNCTIONS
//-----------------------------------------------------------------------------------

// Create Grid
function createGrid() {
  scene.add(new THREE.GridHelper(100, 100, 0xd3d3d3, 0xd3d3d3));
  scene.add(new THREE.GridHelper(100, 10, 0x151515, 0x151515));
}

//BOARDS
function createBoard() {
  const geometry = new THREE.BoxGeometry(40, 2, 40);
  const material = new THREE.MeshPhysicalMaterial();
  material.color = new THREE.Color("#69f");

  const board = new THREE.Mesh(geometry, material);
  board.position.set(0, 1, 0);
  board.name = "board " + boardCounter;
  boardCounter++;
  sceneObjects.push(board);

  scene.add(board);
  group.add(board);
  animate();
}

//BEAMS
function createBeam() {
  const geometry = new THREE.BoxGeometry(40, 2, 2);
  const material = new THREE.MeshPhysicalMaterial();
  material.color = new THREE.Color("#69f");

  const beam = new THREE.Mesh(geometry, material);
  beam.position.set(0, 1, 0);
  beam.name = "beam " + beamCounter;
  beamCounter++;
  sceneObjects.push(beam);

  scene.add(beam);
  group.add(beam);
  animate();
}

//BARS
function createBar() {
  const geometry = new THREE.CylinderGeometry(1, 1, 40, 32);
  const material = new THREE.MeshPhysicalMaterial();
  material.color = new THREE.Color("#69f");

  const bar = new THREE.Mesh(geometry, material);
  bar.position.set(0, 1, 0);
  bar.rotation.set(90 * (Math.PI / 180), 0, 90 * (Math.PI / 180));
  bar.name = "bar " + beamCounter;
  barCounter++;
  sceneObjects.push(bar);

  scene.add(bar);
  group.add(bar);
  animate();
}

//Joint
function createJoint() {
  for (let i = 0; i < 3; i++) {
    const geometry = new THREE.CylinderGeometry(2, 2, 20, 32);
    const material = new THREE.MeshPhysicalMaterial();
    material.color = new THREE.Color("#69f");

    const joint = new THREE.Mesh(geometry, material);
    if (i == 0) {
      joint.position.set(10, 2, 0);
      joint.rotation.set(90 * (Math.PI / 180), 0, 90 * (Math.PI / 180));
    }
    if (i == 1) {
      joint.position.set(0, 12, 0);
    }
    if (i == 2) {
      joint.position.set(0, 2, 10);
      joint.rotation.x = 90 * (Math.PI / 180);
    }
    joint.name = "joint " + jointCounter;
    jointCounter++;
    sceneObjects.push(joint);

    scene.add(joint);
    group.add(joint);
    jointGroup.add(joint);
    animate();
  }
  /*const geometry1 = new THREE.CylinderGeometry(2, 2, 20, 32);
  const geometry2 = new THREE.CylinderGeometry(2, 2, 20, 32);
  const geometry3 = new THREE.CylinderGeometry(2, 2, 20, 32);
  const material = new THREE.MeshPhysicalMaterial();
  material.color = new THREE.Color("#69f");

  const joint1 = new THREE.Mesh(geometry1, material);
  const joint2 = new THREE.Mesh(geometry2, material);
  const joint3 = new THREE.Mesh(geometry3, material);

  joint1.position.set(10, 2, 0);
  joint1.rotation.z = 90 * (Math.PI / 180); // Hier wurde ein Fehler in der Rotation behoben
  joint1.name = "joint 1";
  scene.add(joint1);
  sceneObjects.push(joint1);
  group.add(joint1);

  joint2.position.set(0, 12, 0);
  joint2.name = "joint 2";
  scene.add(joint2);
  sceneObjects.push(joint2);
  group.add(joint2);

  joint3.position.set(0, 2, 10);
  joint3.rotation.x = 90 * (Math.PI / 180); // Hier wurde ein Fehler in der Rotation behoben
  joint3.name = "joint 3";
  scene.add(joint3);
  sceneObjects.push(joint3);
  group.add(joint3);
*/
  // Hier wird eine Gruppe erstellt, um die Gelenke gemeinsam zu transformieren

  //scene.add(group);
  /*
  // Hier wird CSG-Bibliothek angenommen (nicht standardmäßig in Three.js enthalten)
  let bspA = CSG.fromMesh(joint1);
  let bspB = CSG.fromMesh(joint2);

  let bspD = bspA.union(bspB);

  let finalJointMesh = CSG.toMesh(bspD, joint1.matrix, joint1.material);

  // Hier wurde die falsche Variable `FinalJointMesh` durch die korrekte Variable `finalJointMesh` ersetzt
  const jointFinal = new THREE.Mesh(finalJointMesh, material);
  scene.add(jointFinal);
*/
  animate();
}

//Remove 3D Objects and clean the caches
function removeObject(sceneObject) {
  if (!(sceneObject instanceof THREE.Object3D)) return;

  //Remove the geometry to free GPU resources
  if (sceneObject.geometry) sceneObject.geometry.dispose();

  //Remove the material to free GPU resources
  if (sceneObject.material) {
    if (sceneObject.material instanceof Array) {
      sceneObject.material.forEach((material) => material.dispose());
    } else {
      sceneObject.material.dispose();
    }
  }

  //Remove object from scene
  sceneObject.removeFromParent();
}

//RESPONSIVE
function handleResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.render(scene, camera);
}

//RAYCAST
function onPointerMove(event) {
  if (selectedObject) {
    if (selectedObject !== transformedObject) {
      selectedObject.material.color.set("#69f");
    }
    selectedObject = null;
  }

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const intersects = raycaster.intersectObject(group, true);

  if (intersects.length > 0) {
    const res = intersects.filter(function (res) {
      return res && res.object;
    })[0];

    if (res && res.object) {
      selectedObject = res.object;
      if (selectedObject !== transformedObject) {
        selectedObject.material.color.set("#f00");
      }
    }
  }
}

//CLICK
function onClick() {
  if (selectedObject) {
    transformedObject = selectedObject;
    transformedObject.material.color.set("#ff0");
    parameters.width = transformedObject.geometry.parameters.width;
    parameters.height = transformedObject.geometry.parameters.height;
    parameters.depth = transformedObject.geometry.parameters.depth;
    widthController.updateDisplay();
    heightController.updateDisplay();
    depthController.updateDisplay();
    control.attach(transformedObject);
    scene.add(control);
  } else if (transformedObject) {
    deselectTransformedObject();
  }
}

//KEY PRESSED
function onKey() {
  if (event.key === "Escape") {
    deselectTransformedObject();
  }
  if (event.key === "Backspace") {
    deleteTransformedObject();
  }
  if (event.key === "Shift") {
    control.setRotationSnap(THREE.MathUtils.degToRad(15));
    control.setTranslationSnap(10);
  }
}

//KEY RELEASED
function upKey() {
  if (event.key === "Shift") {
    control.setRotationSnap(false);
    control.setTranslationSnap(1);
  }
}

function deleteTransformedObject() {
  removeObject(transformedObject);
  widthController.setValue(null);
  heightController.setValue(null);
  depthController.setValue(null);
  scene.remove(control);
}

function deselectTransformedObject() {
  transformedObject.material.color.set("#69f");
  transformedObject = null;
  widthController.setValue(null);
  heightController.setValue(null);
  depthController.setValue(null);
  scene.remove(control);
}

function moveMode() {
  control.setMode("translate");
}

function rotateMode() {
  control.setMode("rotate");
}

function exportScene() {
  //Started Troubleshooting Alignment

  /*const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-Math.PI / 2, 0, 0)
  );
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.applyQuaternion(quaternion);
    }
  });
  */
  const download = exporter.parse(scene, exporterOptions);
  const blob = new Blob([download], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = parameters.fileName + ".stl";
  link.click();
  return;
}

//ANIMATE AND RENDER
function animate() {
  requestAnimationFrame(animate);

  orbit.update();

  renderer.render(scene, camera);
}
//-----------------------------------------------------------------------------------
// EXECUTE MAIN
//-----------------------------------------------------------------------------------

main();
