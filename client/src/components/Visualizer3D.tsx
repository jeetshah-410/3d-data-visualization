import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Grid } from '@react-three/drei';
import { Fullscreen, Minimize2 } from 'lucide-react';
import { useState } from 'react';

type Point3D = {
  x: number;
  y: number;
  z: number;
};

interface Visualizer3DProps {
  data: Point3D[];
  onBack: () => void;
}

const SpherePoint = ({ x, y, z }: Point3D) => (
  <mesh position={[x, y, z]}>
    <sphereGeometry args={[0.1, 16, 16]} />
    <meshStandardMaterial color="#00bfff" />
  </mesh>
);

const AxisLabels = () => {
  return (
    <>
      <Html position={[5, 0, 0]} style={{ color: 'red', fontWeight: 'bold' }}>X</Html>
      <Html position={[0, 5, 0]} style={{ color: 'green', fontWeight: 'bold' }}>Y</Html>
      <Html position={[0, 0, 5]} style={{ color: 'blue', fontWeight: 'bold' }}>Z</Html>
    </>
  );
};

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
        style={{
          background: '#000000',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls />
        <Grid
          args={[10, 10]}
          cellSize={1}
          sectionSize={5}
          sectionColor="#444"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid={true}
        />
        <axesHelper args={[5]} />
        <AxisLabels />
        {data.map((point, index) => (
          <SpherePoint key={index} {...point} />
        ))}
      </Canvas>

      <div className="absolute top-4 left-4 z-10 space-x-2">
        <button
          onClick={onBack}
          className="bg-white text-black px-3 py-1 rounded hover:bg-gray-200"
        >
          ⬅️ Back
        </button>
        <button
          onClick={toggleFullscreen}
          className="bg-white text-black px-3 py-1 rounded hover:bg-gray-200"
        >
          {fullscreen ? <Minimize2 size={16} /> : <Fullscreen size={16} />}
        </button>
      </div>
    </div>
  );
};

export default Visualizer3D;
