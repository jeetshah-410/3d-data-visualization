import React, { useState } from 'react';
import UploadPage, { Point3D } from './pages/UploadPage';
import Visualizer3D from './components/Visualizer3D';

const App: React.FC = () => {
  const [data, setData] = useState<Point3D[] | null>(null);

  const handleBackToUpload = () => {
    setData(null);
  };

  return (
    <div className="min-h-screen">
      {!data ? (
        <div className="min-h-screen bg-gray-100 p-4 text-center">
          <h1 className="text-2xl font-bold mb-6">3D Data Visualizer</h1>
          <UploadPage onDataParsed={setData} />
        </div>
      ) : (
        <Visualizer3D data={data} onBack={handleBackToUpload} />
      )}
    </div>
  );
};

export default App;