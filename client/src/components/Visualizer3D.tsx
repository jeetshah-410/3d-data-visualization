import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Grid } from '@react-three/drei';
import { Fullscreen, Minimize2 } from 'lucide-react';
import * as d3 from 'd3';

// Type definition
interface Point3D {
  x: number;
  y: number;
  z: number;
  colorValue?: string;
  sizeValue?: number;
  [key: string]: any;
}

interface Visualizer3DProps {
  data: Point3D[];
  onBack: () => void;
}

const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
const sizeScale = d3.scaleLinear().domain([0, 100]).range([0.05, 0.3]);

const SpherePoint: React.FC<Point3D & { id: number }> = ({ id, x, y, z, colorValue, sizeValue, ...meta }) => {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  const color = colorValue ? colorScale(colorValue) : '#00bfff';
  const size = sizeValue ? sizeScale(sizeValue) : 0.1;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(hovered ? 1.15 : 1);
    }
  });

  return (
    <group position={[x, y, z]}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {hovered && (
        <Html distanceFactor={10} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'white',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#000',
            whiteSpace: 'pre-line',
            boxShadow: '0 0 10px rgba(0,0,0,0.3)'
          }}>
            {`ID: ${id}\nPosition: (${x}, ${y}, ${z})\nColor: ${colorValue || 'N/A'}\nSize: ${sizeValue || 'N/A'}`}
          </div>
        </Html>
      )}
    </group>
  );
};

const AxisLabels = () => (
  <>
    <Html position={[5.5, 0, 0]} style={{ color: '#ff4444', fontWeight: 'bold', fontSize: '16px' }}>X</Html>
    <Html position={[0, 5.5, 0]} style={{ color: '#44ff44', fontWeight: 'bold', fontSize: '16px' }}>Y</Html>
    <Html position={[0, 0, 5.5]} style={{ color: '#4444ff', fontWeight: 'bold', fontSize: '16px' }}>Z</Html>
  </>
);

const Visualizer3D: React.FC<Visualizer3DProps> = ({ data, onBack }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-screen relative bg-black">
      <Canvas
        gl={{ antialias: true }}
        style={{ background: '#0a0a0a', position: 'absolute', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} />
        <PerspectiveCamera makeDefault position={[8, 8, 8]} />
        <OrbitControls />

        <Grid args={[20, 20]} cellSize={1} sectionSize={5} sectionColor="#444" cellColor="#222" />
        <axesHelper args={[6]} />
        <AxisLabels />

        {data.map((point, index) => (
          <SpherePoint key={index} id={index} {...point} />
        ))}
      </Canvas>

      <div className="absolute top-4 left-4 z-10 space-x-2">
        <button
          onClick={onBack}
          className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
        >⬅️ Back</button>
        <button
          onClick={toggleFullscreen}
          className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200"
        >{fullscreen ? <Minimize2 size={16} /> : <Fullscreen size={16} />}</button>
      </div>
    </div>
  );
};

export default Visualizer3D;
