import React, { useState, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = 'https://w6ffuwlorj.execute-api.us-east-1.amazonaws.com/prod';

interface ExtractedData {
  productName: string;
  brand: string;
  category: string;
  price: string;
  dimensions: string;
  weight: string;
  description: string;
  additionalDetails: any;
}

interface ProcessingResult {
  imageId: string;
  processingStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  updatedAt?: string;
  fileName?: string;
  extractedData?: ExtractedData;
  errorMessage?: string;
}

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError(null);
    setResult(null);
    setUploading(true);

    try {
      // Get presigned URL
      const uploadResponse = await axios.post(`${API_BASE_URL}/upload`, {
        fileName: file.name,
        fileType: file.type
      });

      const { imageId, uploadUrl } = uploadResponse.data;

      // Upload file to S3
      await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type,
        },
      });

      setUploading(false);
      setProcessing(true);

      // Poll for results
      pollForResults(imageId);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError('Failed to upload image: ' + (err.response?.data?.error || err.message));
      setUploading(false);
    }
  };

  const pollForResults = async (imageId: string) => {
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/results/${imageId}`);
        const data: ProcessingResult = response.data;

        setResult(data);

        if (data.processingStatus === 'COMPLETED' || data.processingStatus === 'FAILED') {
          setProcessing(false);
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000); // Poll every 10 seconds
        } else {
          setProcessing(false);
          setError('Processing timeout - please try again');
        }
      } catch (err: any) {
        console.error('Polling error:', err);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 10000);
        } else {
          setProcessing(false);
          setError('Failed to get results');
        }
      }
    };

    poll();
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Product Image OCR System</h1>
        <p>Upload product images to automatically extract specifications</p>
      </header>

      <main className="main-content">
        <div 
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="upload-content">
            <div className="upload-icon">📷</div>
            <h3>Drag and drop your product image here</h3>
            <p>or</p>
            <label className="file-input-label">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                disabled={uploading || processing}
              />
              Choose File
            </label>
            <p className="file-info">Supports JPG, PNG, GIF, WEBP</p>
          </div>
        </div>

        {uploading && (
          <div className="status-message">
            <div className="spinner"></div>
            <p>Uploading image...</p>
          </div>
        )}

        {processing && (
          <div className="status-message">
            <div className="spinner"></div>
            <p>Processing image with AI...</p>
            {result && (
              <p className="status-detail">Status: {result.processingStatus}</p>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
          </div>
        )}

        {result && result.processingStatus === 'COMPLETED' && result.extractedData && (
          <div className="results-section">
            <h2>Extracted Product Information</h2>
            <div className="results-grid">
              <div className="result-item">
                <label>Product Name:</label>
                <span>{result.extractedData.productName || 'Not detected'}</span>
              </div>
              <div className="result-item">
                <label>Brand:</label>
                <span>{result.extractedData.brand || 'Not detected'}</span>
              </div>
              <div className="result-item">
                <label>Category:</label>
                <span>{result.extractedData.category || 'Not detected'}</span>
              </div>
              <div className="result-item">
                <label>Price:</label>
                <span>{result.extractedData.price || 'Not detected'}</span>
              </div>
              <div className="result-item">
                <label>Dimensions:</label>
                <span>{result.extractedData.dimensions || 'Not detected'}</span>
              </div>
              <div className="result-item">
                <label>Weight:</label>
                <span>{result.extractedData.weight || 'Not detected'}</span>
              </div>
              <div className="result-item full-width">
                <label>Description:</label>
                <span>{result.extractedData.description || 'Not detected'}</span>
              </div>
              {result.extractedData.additionalDetails && Object.keys(result.extractedData.additionalDetails).length > 0 && (
                <div className="result-item full-width">
                  <label>Additional Details:</label>
                  <pre>{JSON.stringify(result.extractedData.additionalDetails, null, 2)}</pre>
                </div>
              )}
            </div>
            <div className="metadata">
              <p><strong>File:</strong> {result.fileName}</p>
              <p><strong>Processed:</strong> {new Date(result.updatedAt || result.createdAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {result && result.processingStatus === 'FAILED' && (
          <div className="error-message">
            <p>❌ Processing failed: {result.errorMessage || 'Unknown error'}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
