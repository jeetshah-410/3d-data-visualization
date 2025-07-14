import React, { useState } from 'react';
import UploadPage, { Point3D } from './pages/UploadPage';
// import Visualizer3D from './components/Visualizer3D'; // We'll build this next

const App: React.FC = () => {
  const [data, setData] = useState<Point3D[] | null>(null);

  return (
    <div className="min-h-screen bg-gray-100 p-4 text-center">
      <h1 className="text-2xl font-bold mb-6">3D Data Visualizer</h1>
      {!data ? (
        <UploadPage onDataParsed={setData} />
      ) : (
        <div>
          {/* Temporary Output */}
          <pre>{JSON.stringify(data, null, 2)}</pre>
          {/* Replace with <Visualizer3D points={data} /> in next step */}
        </div>
      )}
    </div>
  );
};

export default App;
