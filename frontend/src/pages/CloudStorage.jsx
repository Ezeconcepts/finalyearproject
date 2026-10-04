import { useEffect, useState } from "react";
import UploadDetails from "../components/UploadDetails";
import SideBar from "../components/SideBar";
import Menu from "../components/Menu";
import "../css/dashboard.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const CloudStorage = () => {
  const user = JSON.parse(localStorage.getItem("userLoggedIn")) || JSON.parse(localStorage.getItem("userSignedUp"));
  const userId = JSON.parse(localStorage.getItem("user"))?.user;
  const [userFiles, setUserFiles] = useState([]);
  const [selectedCloudFiles, setSelectedCloudFiles] = useState([]);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/files/cloud/${userId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Could not load cloud files.");
        setUserFiles(data.files);
      })
      .catch((err) => setError(err.message));
  }, [userId]);

  const handleDownload = async () => {
    if (!selectedCloudFiles.length || downloading) return;
    setError(null);
    setDownloading(true);
    try {
      const paths = encodeURIComponent(JSON.stringify(selectedCloudFiles));
      const res = await fetch(`${API_URL}/api/files/download-multiple?paths=${paths}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Download failed. Please try again.");
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "attachment.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="main">
      <SideBar />
      <div className="mainbar">
        <div className="header">
          <h3><strong>Welcome, {user?.userName}</strong></h3>
          <Menu />
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="mainbarDetails">
          <UploadDetails userFiles={userFiles} onSelectionChange={setSelectedCloudFiles} />
        </div>
        <div className="footer">
          <button className="encrypt" onClick={handleDownload} disabled={!selectedCloudFiles.length || downloading}>
            {downloading ? "Decrypting…" : "Decrypt"}
          </button>
        </div>
      </div>
    </div>
  );
};
export default CloudStorage;
