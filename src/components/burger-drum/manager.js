
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import * as THREE from "three";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'dat.gui'
import { drumSettings } from './drum-settings'

gsap.registerPlugin(MotionPathPlugin);
class Manager {

  constructor(stage, view, setView) {
    this.stage = stage;
    this.setView = setView;
    this.debug = false;
    this.sounds = {};
    this.raycaster = new THREE.Raycaster();
    this.view = view;

    this.gui = new dat.GUI();
    this.debugFunctions = {export: () => {console.log(JSON.stringify(drumSettings, null, 2))}};
    this.gui.add(this.debugFunctions, 'export')
    if(!this.debug) this.gui.hide();

    
    this.models = {
      burger: {      
        file: 'burger.glb',
        debug: true,
        items: {}
      },
      drumkit: {      
        file: 'drums.glb',
        debug: false,
        items: {}
      }
    }

    this.setupSpotLights();
    this.loadModels();
  }

  setupSpotLights() {
    this.spotlights = {
      left: { light: new THREE.SpotLight('white', 0), target: new THREE.Object3D() },
      right: { light: new THREE.SpotLight('white', 0), target: new THREE.Object3D() }
    }

    const sides = ['left', 'right'];
    sides.forEach(side => {
      const spotLight = this.spotlights[side].light;
      const target = this.spotlights[side].target;

      spotLight.penumbra = 0.1;
      spotLight.angle = 0.6;

      spotLight.castShadow = true;
      spotLight.shadow.mapSize.width = 1024;
      spotLight.shadow.mapSize.height = 1024;
      spotLight.shadow.camera.near = 1;
      spotLight.shadow.camera.far = 10;
      spotLight.shadow.camera.fov = 50;

      spotLight.target = target;

      this.stage.add(spotLight)
      this.stage.add(target)
    })

    this.spotlights.left.light.position.set(-3, 5, 1)
    this.spotlights.right.light.position.set(3, 5, 1)

  }

  playSound(id) {
    const sound = this.sounds[id];
    if(this.view === 'drums' && sound)
    {
      sound.audio.currentTime = 0;
      sound.audio.play()
      gsap.fromTo(sound.object.position, {...sound.from}, {...sound.to, ease: 'elastic' })
    }
  }

  setupSounds() {
    

    console.log(this.models.burger.items)

    const testObjects = [];

    for (const [name, drum] of Object.entries(drumSettings)) {
      if(drum.sound){

        const sound = {
          audio: new Audio(`/sounds/${drum.sound}`),
          object: this.models.burger.items[name],
          from: {[drum.direction] : drum.position[drum.direction] - 0.3},
          to: {[drum.direction] : drum.position[drum.direction]},
        }

        if(sound.object instanceof THREE.Mesh)
        {
          testObjects.push(sound.object)
        }
        else {
          sound.object.children.forEach(obj => {
            obj.name = sound.object.name;
            testObjects.push(obj)
          })
        }

        this.sounds[drum.key] = sound;
        this.sounds[name] = sound;
      }
    }

    document.addEventListener("keydown", (event) => { this.playSound(event.key)})

    this.stage.container.addEventListener('click', (event) =>
    {
        const mouse = {
          x: event.offsetX / this.stage.size.width * 2 - 1,
          y: - (event.offsetY / this.stage.size.height) * 2 + 1
        }
        
        this.raycaster.setFromCamera(mouse, this.stage.camera);
        const intersects = this.raycaster.intersectObjects(testObjects);

        if(intersects.length) {
          this.playSound(intersects[0].object.name)
        }
    })

  }

  setupDrumSettings(item){
    this.positionsDebug[item.name] = {
        position: {x: item.position.x, y: 5, z: item.position.z},
        rotation: {x: item.rotation.x, y: item.rotation.y, z: item.rotation.z},
        scale: {x: item.scale.x, y: item.scale.y, z: item.scale.z},
      }
  }

  addDebug(item){
      const folder = this.gui.addFolder(item.name);

      ['position', 'rotation', 'scale'].forEach(prop => {
        ['x', 'y', 'z'].forEach(direction => {
          folder.add(drumSettings[item.name][prop], direction)
                .min(-5)
                .max(5)
                .step(0.01)
                .name(prop + ' ' + direction)
                .onChange(() => this.updateBurgerPositions())
        })
      })
  }

  loadModels() {
    const loadingManager = new THREE.LoadingManager(() => {
      this.setupSounds();
      this.setView('burger');
    })

    const gltfLoader = new GLTFLoader(loadingManager)

    Object.keys(this.models).forEach(id => {
      const model = this.models[id];
      
      gltfLoader.load(
        `/models/${model.file}`,
        (gltf) =>
        {
            gltf.scene.traverse(child => {
              
              if(child instanceof THREE.Mesh)
              {
                child.receiveShadow = true;
                child.castShadow = true;
              }
            })
                        
            const children = [ ...gltf.scene.children ]

            children.forEach(child => {

              model.items[child.name] = child;
              
              if(model.debug) {
                this.addDebug(child);
              }

              child.home = {
                position: {...child.position},
                rotation: {x: child.rotation.x, y: child.rotation.y, z: child.rotation.z},
                scale: {...child.scale},
              }
              child.position.y *= 2;
              child.visible = false;
              
              this.stage.add(child)
            })
        }
      )  
    })
  }

  moveToDrums() {
    

    gsap.to(this.stage.camera.position, { x: 0, y: 6, z: 6 })
    gsap.to(this.stage.lookAt, { x: 0, y: 1, z: -1 })
    gsap.to(this.stage, { light: 0 })

    gsap.to(this.spotlights.left.target.position, {x: -1, z: -1})
    gsap.to(this.spotlights.right.target.position, {x: 1, z: -1})
    gsap.to(this.spotlights.left.light, {intensity: 10, delay: 0.3})
    gsap.to(this.spotlights.right.light, {intensity: 10, delay: 0.3})

    Object.keys(this.models.burger.items).forEach(key => {
      const item = this.models.burger.items[key];
      const pos = drumSettings[item.name];
      const delay = 0.6 - item.home.position.y * 0.6;
      gsap.to(item.position, {motionPath: [{x: pos.position.x , y: pos.position.y + 0.5 , z: pos.position.z}, {...pos.position}], delay, duration: 1, ease: 'power2.inOut'})
      gsap.to(item.rotation, {...pos.rotation, duration: 3, delay: delay + 0.5, ease: 'elastic'})
      gsap.to(item.scale, {...pos.scale, duration: 1, delay: delay, ease: 'power2.inOut'})
    })
    
    Object.keys(this.models.drumkit.items).forEach(key => {
      const item = this.models.drumkit.items[key];
      item.visible = true;
      gsap.to(item.position, {...item.home.position, duration: 1, ease: 'power4.out'})
      gsap.to(item.rotation, {...item.home.rotation, duration: 1, ease: 'power4.out'})
      gsap.to(item.scale, {...item.home.scale, duration: 1, ease: 'power4.out'})
    })
  }

  updateBurgerPositions() {
    if(this.debug)
    {
      Object.keys(this.models.burger.items).forEach(key => {
        const item = this.models.burger.items[key];
        item.position.copy(drumSettings[item.name].position)
        item.rotation.setFromVector3(drumSettings[item.name].rotation)
        item.scale.copy(drumSettings[item.name].scale)
      })
    }
  }
  
  moveToBurger() {

    gsap.to(this.stage.camera.position, {...this.stage.camera.home.position, duration: 0.6})
    gsap.to(this.stage.lookAt, { x: -1.5, y: 1, z: 0, duration: 0.6 })
    gsap.to(this.stage, { light: 2 })
    gsap.to(this.spotlights.left.target.position, {x: -10, y: 1})
    gsap.to(this.spotlights.right.target.position, {x: 10, y: 1})
    gsap.to(this.spotlights.left.light, {intensity: 0})
    gsap.to(this.spotlights.right.light, {intensity: 0})

    Object.keys(this.models.burger.items).forEach(key => {
      const item = this.models.burger.items[key];
      const delay = 0.2 + item.home.position.y * 0.4;

      item.visible = true;
      gsap.to(item.position, {motionPath: [{x: item.home.position.x , y: item.home.position.y * 3, z: item.home.position.z}, {...item.home.position}], delay, duration: 1.5, ease: 'bounce'})
      gsap.to(item.rotation, {...item.home.rotation, duration: 1, delay, ease: 'power4.inOut'})
      gsap.to(item.scale, {...item.home.scale, duration: 1, delay,  ease: 'power4.inOut'})
    })

    Object.keys(this.models.drumkit.items).forEach(key => {
      const item = this.models.drumkit.items[key];
      gsap.to(item.position, {y: -3, duration: 0.5})
      gsap.to(item.rotation, {z: (Math.random() * 0.5) - 0.25, duration: 0.5})
    })
  }

  updateView(newState) {
    this.view = newState;
    gsap.globalTimeline.clear();
    if(newState === 'burger') this.moveToBurger();
    if(newState === 'drums') this.moveToDrums();
  }

  fire() {
    this.gui.destroy()
  }
}

export { Manager }