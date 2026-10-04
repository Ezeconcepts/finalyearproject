import { useState, useRef, useEffect } from "react";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
import { Link, NavLink, useNavigate } from "react-router-dom";
import UploadDetails from "../components/UploadDetails";

import {
  faBars,
  faClose,
  faUserSlash,
  faFile,
  faLock,
  faCloud,
  faPoll,
} from "@fortawesome/free-solid-svg-icons";

import "../css/dashboard.css";
import SideBar from "../components/SideBar";
import Notification from "../components/Notification";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Menu from "../components/Menu";
const Dashboard = () => {
  const [showPopup, setShowPopup] = useState(false);

  const [icon, setIcon] = useState(faBars);
  const hamburgerRef = useRef(null);
  const hamburgerContentRef = useRef(null);

  const navigate = useNavigate();
  const userId = JSON.parse(localStorage.getItem("user"))?.user;
  const user =
    JSON.parse(localStorage.getItem("userLoggedIn")) ||
    JSON.parse(localStorage.getItem("userSignedUp"));

  const [selectedFile, setSelectedFile] = useState(null);
  const [userFiles, setUserFiles] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const form = document.querySelector("form");

  const getUserFiles = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/files/uploads/${userId}`
      );

      const data = await res.json();

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
    const files = Array.from(e.target.files);
    setSelectedFile(files);
  };
  const handleUpload = async () => {
    if (!selectedFile) return;
    const formData = new FormData(form);
    console.log(formData);

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
          throw Error("an error occured from our end. Please try again");
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

  const handleEncrypt = async () => {
    const filesToEncrypt = selectedFiles;

    if (!filesToEncrypt.length) return;
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/files/encrypt-multiple`,
        {
          method: "POST",
          body: JSON.stringify(filesToEncrypt),
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await res.json();
      console.log(data);

      if (!res.ok || data.error) {
        setError(data.messages || data.error || "Encryption failed. Please try again.");
        return;
      }

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

      navigate("/encrypted-files");
    } catch (error) {
      console.error("Error getting user's files");
    }
  };

  const handleDelete = async () => {
    const filesToDownload = JSON.parse(localStorage.getItem("checked"));

    console.log(filesToDownload);

    if (!filesToDownload) return;
    // const { fileName: name, fileDate: date } = fileToDownload;
    try {
      const res = await fetch(
        `${API_URL}/api/files/delete-multiple`,
        {
          method: "DELETE",
          body: JSON.stringify(filesToDownload),
          headers: { "Content-Type": "application/json" },
        }
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
      getUserFiles()
        .then((files) => {
          if (files) {
            setUserFiles(files);
          }
        })
        .catch((error) => {
          console.error(error);
        });
      return data.files;
    } catch (error) {
      console.error("Error getting user's files");
    }
    console.log("stop!");
  };

  // useEffect(() => {
  //   console.log(hamburgerRef, hamburgerContentRef);
  //   hamburgerRef.current.addEventListener("click", function () {
  //     if (hamburgerContentRef.current.style.display == "block") {
  //       console.log("yes");

  //       hamburgerContentRef.current.style.display = "none";
  //       setIcon(faBars);
  //     } else {
  //       hamburgerContentRef.current.style.display = "block";
  //       console.log("no");

  //       setIcon(faClose);
  //     }
  //     hamburgerContentRef.current.style.top =
  //       hamburgerRef.current.clientHeight + 20 + "px";
  //   });
  // }, []);

  // const handleLogout = () => {
  //   console.log("one second");
  //   localStorage.removeItem("user");
  //   localStorage.removeItem("userSignedUp");
  //   localStorage.removeItem("userLoggedIn");
  //   console.log("redirectingg");
  //   navigate("/login", { reload: true });
  // };
  return (
    <>
      {showPopup && (
        <Notification
          onConfirm={() => {
            handleDelete();
            setShowPopup(false);
          }}
          onCancel={() => setShowPopup(false)}
        />
      )}
      <div className="main">
        <SideBar />
        <div className="mainbar">
          <div className="header">
            <h3>
              <strong>Welcome, {user?.userName}</strong>
            </h3>
<Menu/>
    

            <form encType="multipart/form-data" className="inner-form">
              <button type="button" onClick={() => inputFile.current.click()}>
                Upload
              </button>

              <input
                type="file"
                onChange={handleChange}
                ref={inputFile}
                style={{ display: "none" }}
                name="file"
                multiple
              />
            </form>
            {selectedFile && <p>Selected file: {selectedFile?.name}</p>}
          </div>
          {error && <p role="alert">{String(error)}</p>}
          <UploadDetails userFiles={userFiles} onSelectionChange={setSelectedFiles} />
          <div className="footer">
            <button className="delete" onClick={() => setShowPopup(true)}>
              Delete
            </button>
            <button className="encrypt" onClick={handleEncrypt} disabled={!selectedFiles.length}>
              Encrypt
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default Dashboard;
