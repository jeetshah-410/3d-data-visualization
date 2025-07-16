import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';

export interface Point3D {
  x: number;
  y: number;
  z: number;
  [key: string]: any;
}

interface Props {
  onDataParsed: (data: Point3D[]) => void;
}

const UploadPage: React.FC<Props> = ({ onDataParsed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [xCol, setXCol] = useState('');
  const [yCol, setYCol] = useState('');
  const [zCol, setZCol] = useState('');
  const [colorCol, setColorCol] = useState('');
  const [sizeCol, setSizeCol] = useState('');

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
      setHeaders(res.data.headers);
      setRawData(res.data.data);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed");
    }
    setUploading(false);
  };

  const handleVisualize = () => {
    if (!xCol || !yCol || !zCol) {
      alert("Please select X, Y, and Z columns");
      return;
    }

    const parsedPoints: Point3D[] = rawData.map((row) => ({
      x: parseFloat(row[xCol]),
      y: parseFloat(row[yCol]),
      z: parseFloat(row[zCol]),
      colorValue: row[colorCol],
      sizeValue: parseFloat(row[sizeCol]),
      ...row,
    }));

    onDataParsed(parsedPoints);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-100 via-white to-blue-100 flex justify-center items-start py-16 px-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-10 space-y-8 border border-teal-200">
        <h1 className="text-3xl font-extrabold text-teal-800 mb-2 text-center tracking-wide drop-shadow-md">
          Upload 3D Data File
        </h1>
        <p className="text-gray-600 text-center mb-8 text-lg font-medium">
          Upload a CSV or JSON file containing your 3D data points.
        </p>

        <label
          htmlFor="file-upload"
          className="cursor-pointer flex items-center justify-center gap-3 bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 transition-colors shadow-md focus:outline-none focus:ring-4 focus:ring-teal-300 select-none"
          aria-label="Choose file to upload"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12v8m0-8l-4 4m4-4l4 4M12 4v8" />
          </svg>
          {file ? file.name : "Choose File"}
          <input
            id="file-upload"
            type="file"
            accept=".csv,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 font-semibold text-lg"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>

        <div className="flex flex-wrap gap-6 justify-center mt-6">
          <Dropdown label="Color" value={colorCol} onChange={setColorCol} options={headers} />
          <Dropdown label="Size" value={sizeCol} onChange={setSizeCol} options={headers} />
        </div>

        {headers.length > 0 && (
          <div className="flex flex-col gap-6 items-center mt-8">
            <p className="text-xl font-semibold text-teal-700 tracking-wide drop-shadow-sm">
              Select columns to map
            </p>

            <div className="flex flex-wrap gap-6 justify-center">
              <Dropdown label="X" value={xCol} onChange={setXCol} options={headers} />
              <Dropdown label="Y" value={yCol} onChange={setYCol} options={headers} />
              <Dropdown label="Z" value={zCol} onChange={setZCol} options={headers} />
            </div>

            <button
              onClick={handleVisualize}
              className="mt-4 w-full bg-teal-600 text-white py-3 rounded-xl hover:bg-teal-700 transition-colors shadow-md focus:outline-none focus:ring-4 focus:ring-teal-300 font-semibold text-lg"
            >
              Visualize 3D Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface DropdownProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
}

const Dropdown: React.FC<DropdownProps> = ({ label, value, onChange, options }) => (
  <div className="flex flex-col items-start min-w-[140px]">
    <label className="font-semibold text-gray-700 mb-2">{label}</label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition shadow-sm text-lg"
    >
      <option value="">Select</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

export default UploadPage;
