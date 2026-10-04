import { useState, useRef, useEffect } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
import { Link, NavLink, useNavigate } from "react-router-dom";
import UploadDetails from "../components/UploadDetails";
import { faCloud } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "../css/dashboard.css";

import SideBar from "../components/SideBar";
import Menu from "../components/Menu";

const EncryptedFiles = () => {
  const navigate = useNavigate();

  const user =
    JSON.parse(localStorage.getItem("userLoggedIn")) ||
    JSON.parse(localStorage.getItem("userSignedUp"));

  const [selectedFile, setSelectedFile] = useState(null);
  const [userFiles, setUserFiles] = useState(null);
  const [error, setError] = useState(null);
  const form = document.querySelector("form");
  const userId = JSON.parse(localStorage.getItem("user")).user;

  const getUserFiles = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/files/encrypted/${userId}`
      );

      const data = await res.json();

      console.log(data);

      if (!res.ok) {
        setSelectedFile(null);
        if (data.error === "Internal Server Error") {
          throw Error(
            "there was an error getting user's files. Please try again"
          );
        }
      }

      if (data.error) {
        setSelectedFile(null);
        setError(data.error);
        return;
      }

      return data.files;
    } catch (error) {
      console.error("Error getting user's files");
    }
  };

  const handleChange = async (e) => {
    setError(null);
    const file = e.target.files[0];
    setSelectedFile(file);
  };
  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData(form);

    formData.append("id", userId);

    try {
      const res = await fetch(`${API_URL}/api/files/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setSelectedFile(null);
        if (data.error === "Internal Server Error") {
          throw Error("there was an error signing up. Please try again");
        }
      }

      if (data.error) {
        setSelectedFile(null);
        setError(data.error);
        return;
      }
    } catch (error) {
      console.error("Error uploading file:", error);
    }
    setSelectedFile(null);
    getUserFiles()
      .then((files) => {
        if (files) {
          setUserFiles(files);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  };

  useEffect(() => {
    getUserFiles()
      .then((files) => {
        if (files) {
          setUserFiles(files);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    handleUpload();
  }, [selectedFile]);
  const inputFile = useRef(null);

  const handleCloudUpload = async () => {
    const filesToUploadToCloud = JSON.parse(localStorage.getItem("checked"));
    if (!filesToUploadToCloud || filesToUploadToCloud.length === 0) return;

    const user = JSON.parse(localStorage.getItem("user")).user;
    console.log(filesToUploadToCloud, user);

    const body = {
      files: filesToUploadToCloud,
      user: user,
    };

    console.log(body);
    try {
      const res = await fetch(
        `${API_URL}/api/files/upload/cloud-multiple`,
        {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      );
      console.log(res);
      const data = await res.json();
      console.log(data);

      if (!res.ok) {
        setSelectedFile(null);
        if (data.error === "Internal Server Error") {
          throw Error(
            "there was an error getting user's files. Please try again"
          );
        }
      }

      if (data.error) {
        setSelectedFile(null);
        setError(data.error);
        return;
      }

      navigate("/cloud-storage");
    } catch (error) {
      console.error("Error getting user's files");
    }
  };

  return (
    <div className="main">
      <SideBar />
      <div className="mainbar">
        <div className="header">
          <h3>
            <strong>Welcome, {user.userName}</strong>
          </h3>
          <Menu/>
        </div>
        <div className="mainbarDetails">
          <UploadDetails userFiles={userFiles} />
          {/* change to user files gotten from cloud. should probably be stored in public folder. maybe with type of decrypt. send to backend with decrypt */}
        </div>
        <div className="footer">
          <button className="encrypt" onClick={handleCloudUpload}>
                      <FontAwesomeIcon icon={faCloud} />

            Upload to cloud
          </button>
        </div>
      </div>
    </div>
  );
};
export default EncryptedFiles;
