import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stats, Grid, Text, Box } from '@react-three/drei';
import * as THREE from 'three';

interface DataPoint {
  x: number;
  y: number;
  z: number;
}

interface Visualizer3DProps {
  data: DataPoint[];
  onBack: () => void;
}

// Component for rendering individual data points
function DataPoints({ data }: { data: DataPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  
  // Create instanced geometry for performance
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(data.length * 3);
    const colors = new Float32Array(data.length * 3);
    
    // Calculate data bounds for normalization
    const bounds = data.reduce(
      (acc, point) => ({
        minX: Math.min(acc.minX, point.x),
        maxX: Math.max(acc.maxX, point.x),
        minY: Math.min(acc.minY, point.y),
        maxY: Math.max(acc.maxY, point.y),
        minZ: Math.min(acc.minZ, point.z),
        maxZ: Math.max(acc.maxZ, point.z),
      }),
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
    );
    
    const rangeX = bounds.maxX - bounds.minX || 1;
    const rangeY = bounds.maxY - bounds.minY || 1;
    const rangeZ = bounds.maxZ - bounds.minZ || 1;
    
    data.forEach((point, i) => {
      const i3 = i * 3;
      
      // Normalize positions to fit in a reasonable 3D space
      positions[i3] = ((point.x - bounds.minX) / rangeX - 0.5) * 20;
      positions[i3 + 1] = ((point.y - bounds.minY) / rangeY - 0.5) * 20;
      positions[i3 + 2] = ((point.z - bounds.minZ) / rangeZ - 0.5) * 20;
      
      // Color based on position (creates a nice gradient effect)
      const normalizedX = (point.x - bounds.minX) / rangeX;
      const normalizedY = (point.y - bounds.minY) / rangeY;
      const normalizedZ = (point.z - bounds.minZ) / rangeZ;
      
      colors[i3] = normalizedX;     // Red component
      colors[i3 + 1] = normalizedY; // Green component  
      colors[i3 + 2] = normalizedZ; // Blue component
    });
    
    return { positions, colors };
  }, [data]);
  
  // Update instance matrices
  useEffect(() => {
    if (!meshRef.current) return;
    
    const dummy = new THREE.Object3D();
    for (let i = 0; i < data.length; i++) {
      const i3 = i * 3;
      dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      dummy.scale.setScalar(hovered === i ? 1.5 : 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [data, positions, hovered]);
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, data.length]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(e.instanceId!);
      }}
      onPointerOut={() => setHovered(null)}
    >
      <sphereGeometry args={[0.3, 12, 12]} />
      <meshStandardMaterial vertexColors />
    </instancedMesh>
  );
}

// Animated particle system for visual appeal
function AnimatedParticles() {
  const meshRef = useRef<THREE.Points>(null);
  const particleCount = 1000;
  
  const positions = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 50;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 50;
    }
    return positions;
  }, []);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.02;
    }
  });
  
  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={particleCount}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.02} color="#444" transparent opacity={0.3} />
    </points>
  );
}

// Camera animation controller
function CameraController({ data }: { data: DataPoint[] }) {
  const { camera } = useThree();
  const [isAnimating, setIsAnimating] = useState(true);
  
  useFrame((state) => {
    if (isAnimating && data.length > 0) {
      const time = state.clock.elapsedTime;
      const radius = 25;
      camera.position.x = Math.sin(time * 0.2) * radius;
      camera.position.z = Math.cos(time * 0.2) * radius;
      camera.position.y = Math.sin(time * 0.1) * 5 + 5;
      camera.lookAt(0, 0, 0);
    }
  });
  
  useEffect(() => {
    const timer = setTimeout(() => setIsAnimating(false), 5000);
    return () => clearTimeout(timer);
  }, []);
  
  return null;
}

// Main controls panel
function ControlPanel({ dataCount, onBack }: { dataCount: number; onBack: () => void }) {
  const [showStats, setShowStats] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  
  return (
    <div className="absolute top-4 left-4 z-10 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 text-white">
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          ← Back to Upload
        </button>
        <div className="text-sm">
          <span className="text-gray-400">Data Points:</span>
          <span className="ml-2 font-mono text-green-400">{dataCount}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showStats}
            onChange={(e) => setShowStats(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show Performance Stats</span>
        </label>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show Grid</span>
        </label>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showParticles}
            onChange={(e) => setShowParticles(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Background Particles</span>
        </label>
      </div>
      
      {showStats && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <Stats />
        </div>
      )}
    </div>
  );
}

// Main Visualizer3D component
export default function Visualizer3D({ data, onBack }: Visualizer3DProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);
  
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Initializing 3D Visualization...</p>
          <p className="text-gray-400 text-sm mt-2">Processing {data.length} data points</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-gray-900 overflow-hidden">
      <ControlPanel dataCount={data.length} onBack={onBack} />
      
      <Canvas
        className="w-full h-full"
        camera={{ position: [25, 10, 25], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ scene }) => {
          scene.background = new THREE.Color(0x0f0f0f);
          scene.fog = new THREE.Fog(0x0f0f0f, 30, 100);
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4338ca" />
        
        {/* Camera and Controls */}
        <CameraController data={data} />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
          autoRotate={false}
        />
        
        {/* Grid and Reference */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#333"
          sectionSize={10}
          sectionThickness={1}
          sectionColor="#555"
          fadeDistance={50}
          fadeStrength={1}
        />
        
        {/* Coordinate System Labels */}
        <Text
          position={[12, 0, 0]}
          fontSize={1}
          color="#ff4444"
          anchorX="center"
          anchorY="middle"
        >
          X
        </Text>
        <Text
          position={[0, 12, 0]}
          fontSize={1}
          color="#44ff44"
          anchorX="center"
          anchorY="middle"
        >
          Y
        </Text>
        <Text
          position={[0, 0, 12]}
          fontSize={1}
          color="#4444ff"
          anchorX="center"
          anchorY="middle"
        >
          Z
        </Text>
        
        {/* Data Visualization */}
        <DataPoints data={data} />
        
        {/* Background Particles */}
        <AnimatedParticles />
        
        {/* Coordinate System Arrows */}
        <group>
          <Box args={[20, 0.1, 0.1]} position={[10, 0, 0]} material-color="#ff4444" />
          <Box args={[0.1, 20, 0.1]} position={[0, 10, 0]} material-color="#44ff44" />
          <Box args={[0.1, 0.1, 20]} position={[0, 0, 10]} material-color="#4444ff" />
        </group>
      </Canvas>
      
      {/* Data Info Panel */}
      <div className="absolute bottom-4 right-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 text-white z-10">
        <h3 className="font-semibold mb-2">Visualization Info</h3>
        <div className="space-y-1 text-sm">
          <div>Data Points: <span className="text-green-400">{data.length}</span></div>
          <div>Rendering: <span className="text-blue-400">Instanced Geometry</span></div>
          <div>Performance: <span className="text-yellow-400">Optimized</span></div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
          <div>• Mouse: Orbit camera</div>
          <div>• Scroll: Zoom in/out</div>
          <div>• Right-click: Pan view</div>
        </div>
      </div>
    </div>
  );
}