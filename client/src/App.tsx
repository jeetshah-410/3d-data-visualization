import React, { useState } from 'react';
import UploadPage, { Point3D } from './pages/UploadPage';
import Visualizer3D from './components/Visualizer3D';

const App: React.FC = () => {
  const [data, setData] = useState<Point3D[] | null>(null);

  const handleBackToUpload = () => {
    setData(null);
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      {
        data === null ? (
          <UploadPage onDataParsed={setData} />
        ) : (
          <Visualizer3D data={data} onBack={() => setData(null)} />
        )
      }

    </div>
) ;
};

export default App;