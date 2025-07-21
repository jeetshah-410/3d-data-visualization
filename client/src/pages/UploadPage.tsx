import React, { useState, ChangeEvent, useEffect } from 'react';
import axios from 'axios';

export interface Point3D {
  x: number;
  y: number;
  z: number;
  [key: string]: any;
}

interface UploadedFile {
  filename: string;
  originalname: string;
  size: number;
  mimetype: string;
  metadata: {
    columns: string[];
    rows: number;
    preview: any[];
  };
}

interface Props {
  onDataParsed: (data: Point3D[]) => void;
}

// Configuration for API base URL
const API_BASE_URL = 'https://3d-data-visualization-production.up.railway.app/';


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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_BASE_URL}/api/upload/files`, {
        timeout: 10000 // 10 second timeout
      });
      if (res.data.success) {
        setUploadedFiles(res.data.files);
      }
    } catch (err: any) {
      console.error('Failed to fetch uploaded files:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(''); // Clear any previous errors
    }
  };

  const handleUpload = async () => {
    if (!file) return alert('Please select a file to upload');

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        timeout: 30000, // 30 second timeout for file upload
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setHeaders(res.data.headers);
      setRawData(res.data.data);
      setSelectedFile('');
      await fetchUploadedFiles(); // Refresh the file list
    } catch (err: any) {
      console.error('Upload failed:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Upload failed';
      setError(errorMessage);
      alert(`Upload failed: ${errorMessage}`);
    }
    setUploading(false);
  };

  const handleVisualize = () => {
    if (!headers.length || !rawData.length) {
      alert('No data loaded');
      return;
    }

    const parsedPoints: Point3D[] = rawData.map((row) => ({
      x: xCol && row[xCol] !== undefined ? parseFloat(row[xCol]) || 0 : 0,
      y: yCol && row[yCol] !== undefined ? parseFloat(row[yCol]) || 0 : 0,
      z: zCol && row[zCol] !== undefined ? parseFloat(row[zCol]) || 0 : 0,
      colorValue: colorCol && row[colorCol] !== undefined ? row[colorCol] : undefined,
      sizeValue: sizeCol && row[sizeCol] !== undefined ? parseFloat(row[sizeCol]) || 1 : 1,
      ...row,
    }));

    onDataParsed(parsedPoints);
  };

  const handleFileSelect = async (filename: string) => {
    setSelectedFile(filename);
    setIsMenuOpen(false);
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.get(`${API_BASE_URL}/api/upload/file/${filename}`, {
        timeout: 15000 // 15 second timeout
      });
      if (res.data.success) {
        setHeaders(res.data.headers);
        setRawData(res.data.data);

        // Automatically select first three columns for X, Y, Z if available
        const cols = res.data.headers;
        const defaultX = cols[0] || '';
        const defaultY = cols[1] || '';
        const defaultZ = cols[2] || '';

        // Heuristic to select color column: first non-numeric column not X,Y,Z
        let defaultColor = '';
        for (const col of cols) {
          if (col !== defaultX && col !== defaultY && col !== defaultZ) {
            const sampleValue = res.data.data[0][col];
            if (typeof sampleValue === 'string') {
              defaultColor = col;
              break;
            }
          }
        }

        // Heuristic to select size column: first numeric column not X,Y,Z
        let defaultSize = '';
        for (const col of cols) {
          if (col !== defaultX && col !== defaultY && col !== defaultZ) {
            const sampleValue = res.data.data[0][col];
            if (typeof sampleValue === 'number' || !isNaN(parseFloat(sampleValue))) {
              defaultSize = col;
              break;
            }
          }
        }

        setXCol(defaultX);
        setYCol(defaultY);
        setZCol(defaultZ);
        setColorCol(defaultColor);
        setSizeCol(defaultSize);
      }
    } catch (err: any) {
      console.error('Failed to fetch file data:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch file data';
      setError(errorMessage);
      alert(`Failed to fetch file data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Filter files based on search term
  const filteredFiles = uploadedFiles.filter(file =>
    file.originalname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-100 via-white to-blue-100 relative">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-md">
          <button onClick={() => setError('')} className="float-right text-red-500 hover:text-red-700">
            ×
          </button>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          error ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
        }`}>
          {error ? 'Connection Error' : 'Connected'}
        </div>
      </div>

      {/* Menu Button */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          className="fixed top-4 left-4 z-50 bg-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200"
          aria-label="Open menu"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Slide-out Menu */}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-40 ${
          isMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-teal-800">Uploaded Files</h2>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              <svg
                className="absolute left-3 top-3.5 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
              <p className="text-sm text-gray-600 mt-2">Loading...</p>
            </div>
          )}

          {/* File List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredFiles.length > 0 ? (
              filteredFiles.map((file) => (
                <div
                  key={file.filename}
                  className={`cursor-pointer p-3 rounded-lg border transition-all duration-200 ${
                    selectedFile === file.filename
                      ? 'bg-teal-50 border-teal-300 shadow-sm'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleFileSelect(file.filename)}
                >
                  <div className="font-medium text-gray-800 truncate">
                    {file.originalname}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {file.metadata.rows} rows, {file.metadata.columns.length} columns
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-8">
                {searchTerm ? 'No files found matching your search.' : 'No files uploaded yet.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-30"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex justify-center items-start py-16 px-4">
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
            {file ? file.name : 'Choose File'}
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
            disabled={uploading || !file}
            className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 transition-colors shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 font-semibold text-lg"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>

          {/* Show selected file info */}
          {selectedFile && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
              <h3 className="font-semibold text-teal-800 mb-2">Selected File:</h3>
              <p className="text-sm text-teal-700">
                {uploadedFiles.find(f => f.filename === selectedFile)?.originalname}
              </p>
            </div>
          )}

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

              <div className="flex flex-wrap gap-6 justify-center">
                <Dropdown label="Color" value={colorCol} onChange={setColorCol} options={headers} />
                <Dropdown label="Size" value={sizeCol} onChange={setSizeCol} options={headers} />
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