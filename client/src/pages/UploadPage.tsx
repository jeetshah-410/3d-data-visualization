import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';

interface Props {
  onDataParsed: (data: Point3D[]) => void;
}

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

const UploadPage: React.FC<Props> = ({ onDataParsed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file to upload");

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await axios.post('http://localhost:5000/api/upload', formData);
      onDataParsed(res.data.data);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <input
        type="file"
        accept=".csv,.json"
        onChange={handleFileChange}
        className="text-center"
      />
      <button
        onClick={handleUpload}
        disabled={uploading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {uploading ? "Uploading..." : "Upload & Visualize"}
      </button>
    </div>
  );
};

export default UploadPage;
