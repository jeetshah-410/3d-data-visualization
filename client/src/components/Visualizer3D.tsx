import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html, Grid } from '@react-three/drei';
import { Fullscreen, Minimize2 } from 'lucide-react';
import { InstancedMesh, Object3D, Color, Vector3, Raycaster, Vector2, BufferAttribute } from 'three';
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

const HighPerformanceInstancedPoints: React.FC<{ 
  data: Point3D[]; 
  scales: any; 
  onHover: (index: number | null, point?: Point3D) => void;
  lodLevel: number;
}> = ({ data, scales, onHover, lodLevel }) => {
  const meshRef = useRef<InstancedMesh>(null);
  const tempObject = useMemo(() => new Object3D(), []);
  const tempColor = useMemo(() => new Color(), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const mouse = useMemo(() => new Vector2(), []);
  const { camera, gl } = useThree();
  
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [lastRaycastTime, setLastRaycastTime] = useState(0);
  
  // Throttle raycasting to reduce CPU overhead
  const RAYCAST_THROTTLE = 100; // ms
  
  // Level of Detail - reduce geometry complexity for distant points
  const sphereGeometry = useMemo<[number, number, number]>(() => {
    const segments = lodLevel > 0.5 ? 8 : 16; // Reduce segments when many points
    return [1, segments, segments];
  }, [lodLevel]);

  // Pre-calculate all transformations for better performance
  const instanceData = useMemo(() => {
    return data.map((point, i) => ({
      position: [
        scales.xScale(point.x),
        scales.yScale(point.y),
        scales.zScale(point.z)
      ] as [number, number, number],
      scale: point.sizeValue ? scales.sizeScale(point.sizeValue) : 0.1,
      color: point.colorValue ? colorScale(point.colorValue) : '#00bfff',
      originalIndex: i,
      point
    }));
  }, [data, scales]);

  // Setup instances with optimized batch operations
  useEffect(() => {
    if (!meshRef.current || !instanceData.length) return;

    const mesh = meshRef.current;
    const positions: number[] = [];
    const colors: number[] = [];
    
    // Batch all matrix and color operations
    instanceData.forEach((item, i) => {
      tempObject.position.set(...item.position);
      tempObject.scale.setScalar(item.scale);
      tempObject.updateMatrix();
      
      mesh.setMatrixAt(i, tempObject.matrix);
      
      tempColor.set(item.color);
      mesh.setColorAt(i, tempColor);
      
      // Store positions for optimized raycasting
      positions.push(...item.position);
      colors.push(tempColor.r, tempColor.g, tempColor.b);
    });

    // Single update calls
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    // Store position data for fast distance calculations
    mesh.userData.positions = new Float32Array(positions);
  }, [instanceData, tempObject, tempColor]);

  // Optimized hover detection with spatial optimization
  const handlePointerMove = useCallback((event: any) => {
    const currentTime = Date.now();
    if (currentTime - lastRaycastTime < RAYCAST_THROTTLE) return;
    
    if (!meshRef.current) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;


    raycaster.setFromCamera(mouse, camera);
    
    // Use a more efficient raycasting approach
    raycaster.near = 0.1;
    raycaster.far = 1000;
    
    const intersects = raycaster.intersectObject(meshRef.current, false);
    
    if (intersects.length > 0 && intersects[0].instanceId !== undefined) {
      const instanceId = intersects[0].instanceId;
      if (instanceId !== hoveredIndex && instanceId < instanceData.length) {
        setHoveredIndex(instanceId);
        onHover(instanceId, instanceData[instanceId].point);
        document.body.style.cursor = 'pointer';
      }
    } else {
      if (hoveredIndex !== null) {
        setHoveredIndex(null);
        onHover(null);
        document.body.style.cursor = 'default';
      }
    }
    
    setLastRaycastTime(currentTime);
  }, [camera, hoveredIndex, instanceData, onHover, raycaster, mouse, lastRaycastTime]);

  // Optimized hover animation - only update hovered instance
  useFrame(() => {
    if (!meshRef.current || hoveredIndex === null || hoveredIndex >= instanceData.length) return;
    
    const mesh = meshRef.current;
    const item = instanceData[hoveredIndex];
    
    // Animate only the hovered instance
    tempObject.position.set(...item.position);
    tempObject.scale.setScalar(item.scale * 1.15);
    tempObject.updateMatrix();
    
    mesh.setMatrixAt(hoveredIndex, tempObject.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instanceData.length]}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        if (hoveredIndex !== null) {
          // Reset hovered instance scale
          const item = instanceData[hoveredIndex];
          tempObject.position.set(...item.position);
          tempObject.scale.setScalar(item.scale);
          tempObject.updateMatrix();
          meshRef.current?.setMatrixAt(hoveredIndex, tempObject.matrix);
          if (meshRef.current) {
            meshRef.current.instanceMatrix.needsUpdate = true;
          }
        }
        setHoveredIndex(null);
        onHover(null);
        document.body.style.cursor = 'default';
      }}
      frustumCulled={true} // Enable frustum culling for better performance
    >
      <sphereGeometry args={sphereGeometry} />
      <meshStandardMaterial transparent opacity={0.9} />
    </instancedMesh>
  );
};

const OptimizedTooltip: React.FC<{ 
  hoveredIndex: number | null; 
  hoveredPoint: Point3D | null;
  scales: any;
}> = React.memo(({ hoveredIndex, hoveredPoint, scales }) => {
  if (hoveredIndex === null || !hoveredPoint) return null;
  
  const scaledX = scales.xScale(hoveredPoint.x);
  const scaledY = scales.yScale(hoveredPoint.y);
  const scaledZ = scales.zScale(hoveredPoint.z);

  return (
    <Html 
      position={[scaledX, scaledY + 0.5, scaledZ]} 
      center 
      style={{ pointerEvents: 'none' }}
      distanceFactor={8}
    >
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#000',
        whiteSpace: 'pre-line',
        boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.1)',
        width: '200px'
      }}>
        {`ID: ${hoveredIndex}
X: ${Number(hoveredPoint.x).toFixed(2)}
Y: ${Number(hoveredPoint.y).toFixed(2)}
Z: ${Number(hoveredPoint.z).toFixed(2)}${hoveredPoint.colorValue ? `\nColor: ${hoveredPoint.colorValue}` : ''}${hoveredPoint.sizeValue ? `\nSize: ${hoveredPoint.sizeValue}` : ''}`}
      </div>
    </Html>
  );
});

const DynamicAxisLabels: React.FC<{ ranges: any; axisSize: number }> = React.memo(({ ranges, axisSize }) => (
  <>
    <Html position={[axisSize + 0.5, 0, 0]} style={{ color: '#ff6b6b', fontWeight: 'bold', fontSize: '12px' }}>
      X ({ranges.x.min.toFixed(1)} - {ranges.x.max.toFixed(1)})
    </Html>
    <Html position={[0, axisSize + 0.5, 0]} style={{ color: '#51cf66', fontWeight: 'bold', fontSize: '12px' }}>
      Y ({ranges.y.min.toFixed(1)} - {ranges.y.max.toFixed(1)})
    </Html>
    <Html position={[0, 0, axisSize + 0.5]} style={{ color: '#339af0', fontWeight: 'bold', fontSize: '12px' }}>
      Z ({ranges.z.min.toFixed(1)} - {ranges.z.max.toFixed(1)})
    </Html>
  </>
));

const DataStats: React.FC<{ data: Point3D[]; ranges: any; lodLevel: number }> = React.memo(({ data, ranges, lodLevel }) => (
  <div className="absolute top-4 right-4 z-10 bg-black bg-opacity-90 text-white p-3 rounded-lg text-xs font-mono">
    <div className="font-bold mb-2">Performance Stats</div>
    <div>Points: {data.length.toLocaleString()}</div>
    <div className="mt-1">
      <div>X: {ranges.x.min.toFixed(1)} → {ranges.x.max.toFixed(1)}</div>
      <div>Y: {ranges.y.min.toFixed(1)} → {ranges.y.max.toFixed(1)}</div>
      <div>Z: {ranges.z.min.toFixed(1)} → {ranges.z.max.toFixed(1)}</div>
    </div>
    <div className="mt-2 text-xs opacity-75">
      <div>LOD Level: {(lodLevel * 100).toFixed(0)}%</div>
      <div>Geometry: {lodLevel > 0.5 ? '8x8' : '16x16'} segments</div>
      <div>Optimized InstancedMesh</div>
    </div>
  </div>
));

// Helper function to create sign-preserving scale with padding
const createSignPreservingScale = (values: number[], targetRange: number) => {
  if (values.length === 0) {
    return d3.scaleLinear().domain([0, 1]).range([-targetRange, targetRange]);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    const center = min === 0 ? 0 : min;
    return d3.scaleLinear()
      .domain([center - 1, center + 1])
      .range([-targetRange, targetRange]);
  }

  if (min < 0 && max > 0) {
    const negativeRange = Math.abs(min);
    const positiveRange = max;
    const negativeWithPadding = negativeRange * 1.1;
    const positiveWithPadding = positiveRange * 1.1;
    const totalWithPadding = negativeWithPadding + positiveWithPadding;
    
    const negativeTargetRange = (negativeWithPadding / totalWithPadding) * (targetRange * 2);
    const positiveTargetRange = (positiveWithPadding / totalWithPadding) * (targetRange * 2);
    
    return d3.scaleLinear()
      .domain([-negativeWithPadding, positiveWithPadding])
      .range([-negativeTargetRange, positiveTargetRange]);
  }
  else if (min >= 0) {
    const range = max - min;
    const padding = range * 0.1;
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;
    
    return d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([0, targetRange]);
  }
  else {
    const range = max - min;
    const padding = range * 0.1;
    const domainMin = min - padding;
    const domainMax = Math.min(0, max + padding);
    
    return d3.scaleLinear()
      .domain([domainMin, domainMax])
      .range([-targetRange, 0]);
  }
};

const Visualizer3D: React.FC<Visualizer3DProps> = ({ data, onBack }) => {
  const [fullscreen, setFullscreen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<Point3D | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate LOD level based on data size
  const lodLevel = useMemo(() => {
    return Math.min(1, data.length / 5000); // Higher LOD for more data
  }, [data.length]);

  // Calculate data ranges and create scales
  const { ranges, scales, axisSize } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        ranges: { x: { min: 0, max: 1 }, y: { min: 0, max: 1 }, z: { min: 0, max: 1 } },
        scales: {
          xScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          yScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          zScale: d3.scaleLinear().domain([0, 1]).range([-5, 5]),
          sizeScale: d3.scaleLinear().domain([0, 100]).range([0.05, 0.3])
        },
        axisSize: 5
      };
    }

    const xValues = data.map(d => Number(d.x)).filter(v => !isNaN(v)) as number[];
    const yValues = data.map(d => Number(d.y)).filter(v => !isNaN(v)) as number[];
    const zValues = data.map(d => Number(d.z)).filter(v => !isNaN(v)) as number[];
    const sizeValues = data.map(d => d.sizeValue !== undefined ? Number(d.sizeValue) : undefined).filter(v => v !== undefined && !isNaN(v)) as number[];

    const xExtent = d3.extent(xValues) as [number, number];
    const yExtent = d3.extent(yValues) as [number, number];
    const zExtent = d3.extent(zValues) as [number, number];
    
    let sizeExtentRaw = d3.extent(sizeValues);
    let sizeExtent: [number, number];
    if (!sizeExtentRaw || sizeExtentRaw[0] === undefined || sizeExtentRaw[1] === undefined) {
      sizeExtent = [0, 100];
    } else {
      sizeExtent = [sizeExtentRaw[0], sizeExtentRaw[1]];
    }

    const maxRange = Math.max(
      xExtent[1] - xExtent[0],
      yExtent[1] - yExtent[0],
      zExtent[1] - zExtent[0]
    );
    const dynamicAxisSize = Math.max(5, Math.min(15, maxRange / 2));

    const ranges = {
      x: { min: xExtent[0], max: xExtent[1] },
      y: { min: yExtent[0], max: yExtent[1] },
      z: { min: zExtent[0], max: zExtent[1] }
    };

    const scales = {
      xScale: createSignPreservingScale(xValues, dynamicAxisSize),
      yScale: createSignPreservingScale(yValues, dynamicAxisSize),
      zScale: createSignPreservingScale(zValues, dynamicAxisSize),
      sizeScale: d3.scaleLinear()
        .domain(sizeExtent[0] === sizeExtent[1] ? [sizeExtent[0] - 1, sizeExtent[1] + 1] : sizeExtent)
        .range([0.03, 0.25]) // Smaller size range for better performance
    };

    return { ranges, scales, axisSize: dynamicAxisSize };
  }, [data]);

  const handleHover = useCallback((index: number | null, point?: Point3D) => {
    setHoveredIndex(index);
    setHoveredPoint(point || null);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  const cameraDistance = axisSize * 2;

  return (
    <div ref={containerRef} className="w-full h-screen relative bg-black">
      <Canvas
        gl={{ 
          antialias: data.length < 5000, // Disable antialiasing for large datasets
          powerPreference: "high-performance",
          alpha: false
        }}
        dpr={Math.min(window.devicePixelRatio, 2)} // Limit pixel ratio for better performance
        style={{ 
          background: 'linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%)', 
          position: 'absolute', 
          width: '100%', 
          height: '100%' 
        }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={0.6} />
        <pointLight position={[-10, -10, -10]} intensity={0.2} color="#4444ff" />
        
        <PerspectiveCamera 
          makeDefault 
          position={[cameraDistance, cameraDistance, cameraDistance]} 
          fov={60}
          near={0.1}
          far={1000}
        />
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          maxDistance={axisSize * 6}
          minDistance={axisSize * 0.3}
          enableDamping={true}
          dampingFactor={0.05}
        />

        <Grid 
          args={[axisSize * 4, axisSize * 4]} 
          cellSize={axisSize / 5} 
          sectionSize={axisSize} 
          sectionColor="#404040" 
          cellColor="#252525" 
        />

        <axesHelper args={[axisSize]} />
        <DynamicAxisLabels ranges={ranges} axisSize={axisSize} />

        <HighPerformanceInstancedPoints 
          data={data} 
          scales={scales} 
          onHover={handleHover}
          lodLevel={lodLevel}
        />

        <OptimizedTooltip 
          hoveredIndex={hoveredIndex}
          hoveredPoint={hoveredPoint}
          scales={scales}
        />
      </Canvas>

      <div className="absolute top-4 left-4 z-10 space-x-2">
        <button
          onClick={onBack}
          className="bg-white bg-opacity-90 text-black px-3 py-2 rounded text-sm hover:bg-opacity-100 transition-all shadow-lg"
        >
          ⬅️ Back
        </button>
        <button
          onClick={toggleFullscreen}
          className="bg-white bg-opacity-90 text-black px-3 py-2 rounded text-sm hover:bg-opacity-100 transition-all shadow-lg flex items-center gap-1"
        >
          {fullscreen ? <Minimize2 size={14} /> : <Fullscreen size={14} />}
          {fullscreen ? 'Exit' : 'Full'}
        </button>
      </div>

      <DataStats data={data} ranges={ranges} lodLevel={lodLevel} />
    </div>
  );
};

export default Visualizer3D;