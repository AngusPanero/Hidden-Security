import * as THREE from 'three'
import React, { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Environment, Lightformer } from '@react-three/drei'
import { Physics, RigidBody, RigidBodyApi, CuboidCollider, BallCollider } from '@react-three/rapier'
import { easing } from 'maath'
import { UseWidth } from '../contexts/WidthContext'
import { UseTheme } from '../contexts/ThemeContext'

const PALETTES = {
  dark: ['#55cb00', '#ffffff', '#000000'],
  light: ['#ff5500', '#ffffff', '#000000']
}

const TOTAL_ITEMS = 52

export const LusionMinimal = () => {
  const { width } = UseWidth()
  const { theme } = UseTheme()
  const isMobile = width <= 768
  const bgColor = theme === "dark" ? "#000000" : "#ffffff"

  return (
    <div style={{ width: '100vw', height: isMobile ? '80vh' : '100vh', overflow: 'hidden', backgroundColor: bgColor, position: 'relative' }}>
      <Canvas shadows camera={{ position: [0, 2, 20], fov: 35 }} style={{ touchAction: 'none' }}>
        <color attach="background" args={[bgColor]} />
        <Scene theme={theme} isMobile={isMobile} />
      </Canvas>
    </div>
  )
}

function Scene({ theme, isMobile }: { theme: string, isMobile: boolean }) {
  const currentPalette = theme === 'dark' ? PALETTES.dark : PALETTES.light
  const itemData = useMemo(() => 
    Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
      id: i,
      position: [THREE.MathUtils.randFloatSpread(10), THREE.MathUtils.randFloat(5, 15), THREE.MathUtils.randFloatSpread(3)] as [number, number, number],
      colorIndex: i % currentPalette.length,
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number]
    })), [currentPalette.length])

  return (
    <>
      <ambientLight intensity={theme === "dark" ? 0.5 : 1.5} />
      <pointLight position={[10, 10, 10]} intensity={theme === "dark" ? 1 : 2} />
      
      <Physics gravity={[0, -9.81, 0]} colliders={false}>
        <MouseStriker isMobile={isMobile} />
        <GlassCage theme={theme} />

        {itemData.map((data) => (
          <CandyConnector key={data.id} {...data} color={currentPalette[data.colorIndex]} />
        ))}
      </Physics>

      <Environment resolution={256} preset="apartment">
        <Lightformer form="rect" intensity={5} position={[2, 5, -10]} scale={[10, 1, 1]} />
      </Environment>
    </>
  )
}

function CandyConnector({ position, color, rotation }: { position: [number, number, number], color: string, rotation: [number, number, number] }) {
  const api = useRef<RigidBodyApi>(null!)
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHover] = useState(false)

  useFrame((_state, delta) => {
    if (!api.current) return
    const targetColor = new THREE.Color(hovered ? '#ffffff' : color)
    // @ts-ignore
    easing.dampC(meshRef.current.material.color, targetColor, 0.2, delta)
    // @ts-ignore
    easing.dampC(meshRef.current.material.emissive, new THREE.Color(hovered ? '#ffffff' : '#000000'), 0.1, delta)
  })

  // Función para empujar el objeto
  const handlePointerOver = () => {
    setHover(true)
    if (api.current) {
      // Aplicamos un impulso aleatorio cada vez que el mouse entra
      api.current.applyImpulse({ 
        x: (Math.random() - 0.5) * 55, 
        y: Math.random() * 50, 
        z: (Math.random() - 0.5) * 55 
      }, true)
      
      // También añadimos un poco de rotación aleatoria para que el golpe se sienta real
      api.current.applyTorqueImpulse({
        x: Math.random() * 2,
        y: Math.random() * 2,
        z: Math.random() * 2
      }, true)
    }
  }

  return (
    <RigidBody 
      ref={api} 
      position={position} 
      rotation={rotation}
      colliders={false} 
      linearDamping={0.5}
      angularDamping={0.5}
      restitution={0.9}
      friction={0.2}
      onPointerOver={handlePointerOver}
      onPointerOut={() => setHover(false)}
    >
      <CuboidCollider args={[0.38, 1.27, 0.38]} />
      <CuboidCollider args={[1.27, 0.38, 0.38]} />
      <CuboidCollider args={[0.38, 0.38, 1.27]} />
      <Model ref={meshRef} />
    </RigidBody>
  )
}

const Model = React.forwardRef<THREE.Mesh>((props, ref) => {
  const { nodes } = useGLTF('/c-transformed.glb') as any
  return (
    <mesh ref={ref} scale={10} geometry={nodes.connector.geometry} castShadow receiveShadow>
      <meshStandardMaterial roughness={0.05} metalness={0.2} />
    </mesh>
  )
})

function GlassCage({ theme }: { theme: string }) {
  const { viewport } = useThree()
  const thickness = 10
  return (
    <RigidBody type="fixed" colliders="cuboid" restitution={1} friction={0.1}>
      <CuboidCollider args={[viewport.width, thickness, 120]} position={[0, -viewport.height / 2 - thickness, 0]} />
      <CuboidCollider args={[viewport.width, thickness, 30]} position={[0, viewport.height / 2 + thickness, 0]} />
      <CuboidCollider args={[thickness, viewport.height, 30]} position={[-viewport.width / 2 - thickness, 0, 0]} />
      <CuboidCollider args={[thickness, viewport.height, 30]} position={[viewport.width / 2 + thickness, 0, 0]} />
    </RigidBody>
  )
}

function MouseStriker({ isMobile }: { isMobile: boolean }) {
  const ref = useRef<RigidBodyApi>(null!)
  const vec = new THREE.Vector3()
  useFrame(({ mouse, viewport }) => {
    vec.set((mouse.x * viewport.width) / 2, (mouse.y * viewport.height) / 2, 0)
    if (ref.current) ref.current.setNextKinematicTranslation(vec)
  })
  return (
    <RigidBody ref={ref} type="kinematicPosition" colliders={false} restitution={1.5}>
      <BallCollider args={[isMobile ? 1.5 : 2]} />
    </RigidBody>
  )
}

useGLTF.preload('/c-transformed.glb')